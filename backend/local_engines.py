"""Luchii in-house engines: Piper (voice), faster-whisper (STT), SD-Turbo (images), Shap-E (3D), OpenVoice (voice conversion). CPU only."""
import base64
import io
import logging
import os
import threading
import wave
from pathlib import Path
from typing import Optional

import httpx

logger = logging.getLogger("luchii.local")
MODELS_DIR = Path(os.environ["LUCHII_MODELS_DIR"])
MODELS_DIR.mkdir(parents=True, exist_ok=True)
SCRATCH_MODELS_DIR = Path(os.environ["LUCHII_SCRATCH_MODELS_DIR"])
SCRATCH_MODELS_DIR.mkdir(parents=True, exist_ok=True)
OPENVOICE_REPO = "myshell-ai/OpenVoiceV2"
SHAPE_MODEL = "openai/shap-e"
SHAPE_STEPS = 10


def cpu_threads() -> int:
    try:
        quota, period = open("/sys/fs/cgroup/cpu.max").read().split()
        if quota != "max":
            return max(1, int(int(quota) / int(period)))
    except (OSError, ValueError):
        pass
    return max(1, (os.cpu_count() or 4) - 2)

PIPER_BASE = "https://huggingface.co/rhasspy/piper-voices/resolve/main"
PIPER_VOICES = {
    "nova": "en_US-amy-medium", "alloy": "en_US-lessac-medium", "echo": "en_US-ryan-medium",
    "fable": "en_GB-alan-medium", "onyx": "en_US-joe-medium", "shimmer": "en_US-kristin-medium",
    "sage": "en_US-hfc_female-medium", "coral": "en_GB-jenny_dioco-medium", "ash": "en_US-hfc_male-medium",
}
IMAGE_MODEL = "stabilityai/sd-turbo"
# Photoreal engine (Luchii Nova-Muse): Realistic Vision V6 + LCM-LoRA, 4 steps. Weights live on the
# persistent volume (LUCHII_PHOTO_MODELS_DIR) so they survive pod restarts.
PHOTO_MODELS_DIR = Path(os.environ["LUCHII_PHOTO_MODELS_DIR"])
PHOTO_REPO = "SG161222/Realistic_Vision_V6.0_B1_noVAE"
PHOTO_FILE = "Realistic_Vision_V6.0_NV_B1_fp16.safetensors"
PHOTO_VAE = "stabilityai/sd-vae-ft-mse"
PHOTO_LCM = "latent-consistency/lcm-lora-sdv1-5"
PHOTO_STEPS = 4
PHOTO_DRAFT_STEPS = 3
PHOTO_NEGATIVE = ("nsfw, nude, deformed face, distorted, disfigured, blurry, cartoon, painting, lowres, "
                  "bad anatomy, extra fingers, watermark, text")
PHOTO_ASPECTS = {"1:1": (512, 512), "16:9": (704, 384), "9:16": (384, 704), "4:3": (576, 448), "3:4": (512, 640)}
ASPECTS = {"1:1": (512, 512), "16:9": (640, 384), "9:16": (384, 640), "4:3": (576, 448), "3:4": (448, 576)}

_voices: dict = {}
_whisper = None
_t2i = None
_i2i = None
_photo = None
_ip2p = None
_voice_lock = threading.Lock()
_image_lock = threading.Lock()
_stt_lock = threading.Lock()
_shape = None
_converter = None
_shape_lock = threading.Lock()
_convert_lock = threading.Lock()
# Only ONE heavy engine (SD image/video, Shap-E 3D, MusicGen, OpenVoice) may be
# resident at a time on this 8GB/2-core CPU pod. _heavy_lock serializes heavy work
# and _claim() frees the others before a different engine loads, preventing the
# two-models-resident memory collision that evicts the pod.
_heavy_lock = threading.RLock()


def _claim(keep: str):
    global _t2i, _i2i, _shape, _shape_i2m, _music, _photo, _ip2p
    freed = []
    if keep != "image" and _t2i is not None:
        _t2i = _i2i = None
        freed.append("image")
    if keep != "photo" and _photo is not None:
        _photo = None
        freed.append("photo")
    if keep != "edit" and _ip2p is not None:
        _ip2p = None
        freed.append("edit")
    if keep != "shape" and (_shape is not None or _shape_i2m is not None):
        _shape = _shape_i2m = None
        freed.append("shape")
    if keep != "music" and _music is not None:
        _music = None
        freed.append("music")
    if freed:
        import gc
        gc.collect()
        _release_memory()
        logger.info("Freed heavy engine(s) %s to make room for %s", freed, keep)


def _release_memory():
    """Return freed heap back to the OS. Python/glibc keep freed arenas by
    default, so after unloading a multi-GB model the RSS stays high and the next
    model load spikes past the pod memory limit. malloc_trim forces the release."""
    try:
        import ctypes
        ctypes.CDLL("libc.so.6").malloc_trim(0)
    except Exception:  # noqa: BLE001
        pass


# ---------- voice ----------
def _piper_file(name: str, ext: str) -> Path:
    lang, speaker, quality = name.split("-")
    path = MODELS_DIR / "piper" / f"{name}.{ext}"
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        url = f"{PIPER_BASE}/{lang.split('_')[0]}/{lang}/{speaker}/{quality}/{name}.{ext}"
        logger.info("Downloading Piper voice %s", url)
        with httpx.stream("GET", url, follow_redirects=True, timeout=300) as r:
            r.raise_for_status()
            tmp = path.with_suffix(path.suffix + ".part")
            with open(tmp, "wb") as f:
                for chunk in r.iter_bytes():
                    f.write(chunk)
            tmp.rename(path)
    return path


def _voice(voice: str):
    from piper import PiperVoice
    name = PIPER_VOICES.get(voice, PIPER_VOICES["nova"])
    if name not in _voices:
        _piper_file(name, "onnx.json")
        _voices[name] = PiperVoice.load(str(_piper_file(name, "onnx")))
    return _voices[name]


def synthesize(text: str, voice: str = "nova") -> dict:
    with _voice_lock:
        v = _voice(voice)
        buf = io.BytesIO()
        with wave.open(buf, "wb") as wf:
            if hasattr(v, "synthesize_wav"):
                v.synthesize_wav(text, wf)
            else:
                v.synthesize(text, wf)
    return {"audio_base64": base64.b64encode(buf.getvalue()).decode(), "mime": "audio/wav"}


# ---------- transcription ----------
def transcribe(data: bytes) -> str:
    global _whisper
    with _stt_lock:
        if _whisper is None:
            from faster_whisper import WhisperModel
            _whisper = WhisperModel("base", device="cpu", compute_type="int8", download_root=str(MODELS_DIR / "whisper"))
        segments, _ = _whisper.transcribe(io.BytesIO(data), vad_filter=True)
        return " ".join(s.text.strip() for s in segments).strip()


# ---------- images ----------
def _pipes():
    global _t2i, _i2i
    if _t2i is None:
        import torch
        from diffusers import AutoPipelineForText2Image, AutoPipelineForImage2Image, AutoencoderTiny
        torch.set_num_threads(cpu_threads())
        # fp16 weights (half the download/disk) on the persistent volume, upcast to fp32 for CPU.
        _t2i = AutoPipelineForText2Image.from_pretrained(IMAGE_MODEL, variant="fp16", torch_dtype=torch.float32,
                                                         cache_dir=str(PHOTO_MODELS_DIR))
        # TAESD tiny VAE: ~2x faster decode on CPU vs the full VAE, negligible quality loss.
        _t2i.vae = AutoencoderTiny.from_pretrained("madebyollin/taesd", torch_dtype=torch.float32,
                                                   cache_dir=str(PHOTO_MODELS_DIR))
        _t2i.unet = _t2i.unet.to(memory_format=torch.channels_last)
        _t2i.set_progress_bar_config(disable=True)
        _i2i = AutoPipelineForImage2Image.from_pipe(_t2i)
        _i2i.set_progress_bar_config(disable=True)
    return _t2i, _i2i


def warm_up():
    """Lightweight boot: pre-cache only the small Piper voice. Heavy engines
    (SD-Turbo, Shap-E, MusicGen, OpenVoice) load lazily on first use and only one
    big model stays resident at a time (see _claim). Pre-loading SD at boot was
    removed: it permanently held ~2.5GB, leaving too little headroom for Shap-E's
    ~4GB load on this ~6GB-effective pod and causing evictions."""
    try:
        _voice("nova")
        logger.info("Luchii voice engine ready; image/3D/music/clone load on first use")
    except Exception:  # noqa: BLE001
        logger.exception("Luchii in-house engine warm-up failed")


def prefetch_scratch_models():
    """One-time background download of 3D/music weights to persistent disk."""
    try:
        from huggingface_hub import snapshot_download
        for repo in (SHAPE_MODEL, SHAPE_IMG_MODEL, MUSIC_MODEL):
            snapshot_download(repo, cache_dir=str(SCRATCH_MODELS_DIR / "hf"))
        logger.info("Scratch models (3D, music) cached on persistent disk")
    except Exception:  # noqa: BLE001
        logger.exception("Scratch model prefetch failed")


def _to_data_url(img) -> str:
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def _to_jpeg_url(img, quality: int = 93) -> str:
    buf = io.BytesIO()
    img.convert("RGB").save(buf, format="JPEG", quality=quality, subsampling=0, optimize=True)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


HD_SCALE = 2  # every 512px render is super-resolved (Luchii Prime compact, ~7s) to a crisp 2x HD image
SR_BLEND = 0.8  # keep 20% of the Lanczos image so skin and fabric keep natural texture


def _hd(img, longest: Optional[int] = None, kind: str = "compact") -> str:
    """Luchii Prime finishing pass: real-ESRGAN super-resolution, blended with Lanczos for natural texture."""
    from PIL import Image
    import luchii_sr
    target = longest or max(img.size) * HD_SCALE
    try:
        sr = luchii_sr.enhance(img, target, kind)
        soft = img.convert("RGB").resize(sr.size, Image.LANCZOS)
        return _to_jpeg_url(Image.blend(soft, sr, SR_BLEND))
    except Exception:  # noqa: BLE001
        logger.exception("Luchii Prime finishing pass failed; returning the base render")
        return _to_data_url(img)


def _load_image(b64: str, longest: int):
    from PIL import Image
    raw = base64.b64decode(b64.split(",", 1)[1] if b64.startswith("data:") else b64)
    img = Image.open(io.BytesIO(raw)).convert("RGB")
    scale = longest / max(img.size)
    w, h = (max(64, int(d * scale) // 64 * 64) for d in img.size)
    return img.resize((w, h), Image.LANCZOS)


def preview(b64: str, longest: int = 768) -> str:
    """Light JPEG preview of a large (HD/4K) image for gallery and history lists."""
    from PIL import Image
    raw = base64.b64decode(b64.split(",", 1)[1] if b64.startswith("data:") else b64)
    img = Image.open(io.BytesIO(raw)).convert("RGB")
    img.thumbnail((longest, longest), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def thumbnail(b64: str) -> str:
    img = _load_image(b64, 256)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=80)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def generate_image(prompt: str, aspect: Optional[str] = "1:1") -> str:
    w, h = ASPECTS.get(aspect or "1:1", ASPECTS["1:1"])
    with _heavy_lock, _image_lock:
        _claim("image")
        t2i, _ = _pipes()
        img = t2i(prompt=prompt, num_inference_steps=1, guidance_scale=0.0, width=w, height=h).images[0]
        return _hd(img)


def edit_image(prompt: str, image_b64: str, strength: float = 0.6, longest: int = 512) -> str:
    src = _load_image(image_b64, longest)
    steps = max(2, int(round(1 / strength)) + 1)
    with _heavy_lock, _image_lock:
        _claim("image")
        _, i2i = _pipes()
        img = i2i(prompt=prompt, image=src, num_inference_steps=steps, strength=strength, guidance_scale=0.0).images[0]
    return _to_data_url(img)


# ---------- Painter-X: instruction-based editing (InstructPix2Pix) ----------
EDIT_MODEL = "timbrooks/instruct-pix2pix"
EDIT_STEPS = 10
EDIT_IMAGE_GUIDANCE = 1.6  # a little higher than the 1.5 default so faces and layout stay closer to the photo


def _ip2p_pipe():
    global _ip2p
    if _ip2p is None:
        import torch
        from huggingface_hub import snapshot_download
        from diffusers import EulerAncestralDiscreteScheduler, StableDiffusionInstructPix2PixPipeline
        torch.set_num_threads(cpu_threads())
        path = snapshot_download(EDIT_MODEL, cache_dir=str(SCRATCH_MODELS_DIR / "hf"), allow_patterns=[
            "model_index.json", "scheduler/*", "tokenizer/*", "feature_extractor/*", "text_encoder/config.json",
            "text_encoder/model.fp16.safetensors", "unet/config.json", "unet/diffusion_pytorch_model.fp16.safetensors",
            "vae/config.json", "vae/diffusion_pytorch_model.fp16.safetensors"])
        pipe = StableDiffusionInstructPix2PixPipeline.from_pretrained(path, variant="fp16", torch_dtype=torch.float32,
                                                                      safety_checker=None, requires_safety_checker=False)
        pipe.scheduler = EulerAncestralDiscreteScheduler.from_config(pipe.scheduler.config)
        pipe.unet = pipe.unet.to(memory_format=torch.channels_last)
        pipe.set_progress_bar_config(disable=True)
        _ip2p = pipe
        logger.info("Luchii Painter-X edit engine loaded")
    return _ip2p


def instruct_edit(instruction: str, image_b64: str, longest: int = 512) -> str:
    """Follows plain-language edit commands ("make it snowy", "turn day into night") while keeping the
    original layout. ~2.5 min on this 2-core CPU, so callers run it as a job."""
    src = _load_image(image_b64, longest)
    with _heavy_lock, _image_lock:
        _claim("edit")
        pipe = _ip2p_pipe()
        img = pipe(instruction, image=src, num_inference_steps=EDIT_STEPS, guidance_scale=7.0,
                   image_guidance_scale=EDIT_IMAGE_GUIDANCE).images[0]
        return _hd(img)


UPSCALE_BASE = 640     # Prime (RRDB x4) input size: 640 -> 2560 in ~2.5 min on this 2-core CPU
UPSCALE_LONGEST = 3840  # true 4K UHD long edge


def upscale_image(image_b64: str) -> str:
    """Luchii Prime 4K: Real-ESRGAN x4plus super-resolution, then resampled to a 3840px long edge."""
    from PIL import Image
    raw = base64.b64decode(image_b64.split(",", 1)[1] if image_b64.startswith("data:") else image_b64)
    img = Image.open(io.BytesIO(raw)).convert("RGB")
    if max(img.size) > UPSCALE_BASE:
        s = UPSCALE_BASE / max(img.size)
        img = img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS)
    import luchii_sr
    with _image_lock:
        big = luchii_sr.enhance(img, UPSCALE_LONGEST, "prime")
        soft = img.resize(big.size, Image.LANCZOS)
        out = Image.blend(soft, big, 0.85)
    return _to_jpeg_url(out, 90)


def _photo_pipe():
    global _photo
    if _photo is None:
        import torch
        from huggingface_hub import snapshot_download
        from diffusers import AutoencoderKL, LCMScheduler, StableDiffusionPipeline
        torch.set_num_threads(cpu_threads())
        cache = str(PHOTO_MODELS_DIR)
        rv = snapshot_download(PHOTO_REPO, cache_dir=cache, allow_patterns=[
            PHOTO_FILE, "model_index.json", "scheduler/*", "tokenizer/*", "text_encoder/config.json",
            "unet/config.json", "vae/config.json", "feature_extractor/*"])
        vae = AutoencoderKL.from_pretrained(snapshot_download(PHOTO_VAE, cache_dir=cache, allow_patterns=[
            "config.json", "diffusion_pytorch_model.safetensors"]), torch_dtype=torch.float32)
        pipe = StableDiffusionPipeline.from_single_file(f"{rv}/{PHOTO_FILE}", config=rv, vae=vae, torch_dtype=torch.float32,
                                                        safety_checker=None, requires_safety_checker=False)
        pipe.scheduler = LCMScheduler.from_config(pipe.scheduler.config)
        pipe.load_lora_weights(snapshot_download(PHOTO_LCM, cache_dir=cache))
        pipe.fuse_lora()
        pipe.unet = pipe.unet.to(memory_format=torch.channels_last)
        pipe.set_progress_bar_config(disable=True)
        _photo = pipe
        logger.info("Luchii photoreal engine (Nova-Muse) loaded")
    return _photo


def generate_photo(prompt: str, aspect: Optional[str] = "1:1", draft: bool = False, seed: Optional[int] = None) -> str:
    """Photoreal render (Luchii Nova-Muse). Full: 4 steps, ~2 min on this 2-core CPU. Draft: 3/4 size and
    3 steps, under a minute. The same seed keeps the draft and full render close in composition."""
    import torch
    w, h = PHOTO_ASPECTS.get(aspect or "1:1", PHOTO_ASPECTS["1:1"])
    if draft:
        w, h = (max(256, int(d * 0.75) // 64 * 64) for d in (w, h))
    with _heavy_lock, _image_lock:
        _claim("photo")
        pipe = _photo_pipe()
        gen = torch.Generator().manual_seed(int(seed)) if seed is not None else None
        img = pipe(prompt=prompt, negative_prompt=PHOTO_NEGATIVE, num_inference_steps=PHOTO_DRAFT_STEPS if draft else PHOTO_STEPS,
                   guidance_scale=1.0, width=w, height=h, generator=gen).images[0]
        return _hd(img)


def image_busy() -> bool:
    return _image_lock.locked()


def status() -> dict:
    voice_ready = any((MODELS_DIR / "piper").glob("*.onnx")) if (MODELS_DIR / "piper").exists() else False
    image_ready = any(PHOTO_MODELS_DIR.glob("models--stabilityai--sd-turbo/snapshots/*/unet/*.safetensors"))
    shape_ready = (SCRATCH_MODELS_DIR / "hf").exists() and any((SCRATCH_MODELS_DIR / "hf").rglob("*.bin"))
    return {"voice_downloaded": voice_ready, "image_downloaded": image_ready, "image_loaded": _t2i is not None,
            "shape_downloaded": shape_ready, "shape_loaded": _shape is not None, "converter_loaded": _converter is not None}


# ---------- 3D ----------
_shape_i2m = None
SHAPE_IMG_MODEL = "openai/shap-e-img2img"


def _fast_scheduler(pipe):
    from diffusers import DPMSolverMultistepScheduler
    pipe.scheduler = DPMSolverMultistepScheduler(
        num_train_timesteps=1024, trained_betas=pipe.scheduler.betas.numpy(), prediction_type="sample",
        algorithm_type="dpmsolver++", use_karras_sigmas=True)
    pipe.set_progress_bar_config(disable=True)
    return pipe


def _shape_pipe(from_image: bool = False):
    global _shape, _shape_i2m
    import torch
    torch.set_num_threads(cpu_threads())
    cache = str(SCRATCH_MODELS_DIR / "hf")
    if from_image:
        if _shape_i2m is None:
            from diffusers import ShapEImg2ImgPipeline
            _shape_i2m = _fast_scheduler(ShapEImg2ImgPipeline.from_pretrained(SHAPE_IMG_MODEL, torch_dtype=torch.float32, low_cpu_mem_usage=True, cache_dir=cache))
        return _shape_i2m
    if _shape is None:
        from diffusers import ShapEPipeline
        _shape = _fast_scheduler(ShapEPipeline.from_pretrained(SHAPE_MODEL, torch_dtype=torch.float32, low_cpu_mem_usage=True, cache_dir=cache))
    return _shape


def generate_3d(prompt: str, image_b64: Optional[str] = None) -> bytes:
    import numpy as np
    import trimesh
    with _heavy_lock, _shape_lock:
        _claim("shape")
        pipe = _shape_pipe(from_image=bool(image_b64))
        source = _load_image(image_b64, 256) if image_b64 else prompt
        guidance = 3.0 if image_b64 else 15.0
        latents = pipe(source, guidance_scale=guidance, num_inference_steps=SHAPE_STEPS, output_type="latent").images
        mesh = pipe.shap_e_renderer.decode_to_mesh(latents[0, None], "cpu")
    verts = mesh.verts.cpu().numpy()[:, [0, 2, 1]] * [1, 1, -1]
    colors = np.stack([mesh.vertex_channels[k].cpu().numpy() for k in "RGB"], 1)
    tm = trimesh.Trimesh(vertices=verts, faces=mesh.faces.cpu().numpy(),
                         vertex_colors=(colors * 255).clip(0, 255).astype("uint8"))
    return tm.export(file_type="glb")


# ---------- voice conversion ----------
def _openvoice():
    global _converter
    if _converter is None:
        import sys
        from huggingface_hub import hf_hub_download
        sys.path.insert(0, str(Path(__file__).parent / "vendor"))
        from openvoice.api import ToneColorConverter
        root = MODELS_DIR / "openvoice"
        cfg = hf_hub_download(OPENVOICE_REPO, "converter/config.json", local_dir=str(root))
        ckpt = hf_hub_download(OPENVOICE_REPO, "converter/checkpoint.pth", local_dir=str(root))
        conv = ToneColorConverter(cfg, device="cpu")
        conv.load_ckpt(ckpt)
        _converter = conv
    return _converter


def _to_wav_file(data: bytes, path: Path, rate: int = 22050) -> float:
    import av
    import numpy as np
    import soundfile
    chunks = []
    with av.open(io.BytesIO(data)) as container:
        resampler = av.AudioResampler(format="flt", layout="mono", rate=rate)
        for frame in container.decode(audio=0):
            for f in resampler.resample(frame):
                chunks.append(f.to_ndarray().reshape(-1))
        for f in resampler.resample(None):
            chunks.append(f.to_ndarray().reshape(-1))
    audio = np.concatenate(chunks) if chunks else np.zeros(0, dtype="float32")
    soundfile.write(str(path), audio, rate)
    return len(audio) / rate


def audio_duration(data: bytes) -> float:
    import tempfile
    with tempfile.TemporaryDirectory() as tmp:
        return round(_to_wav_file(data, Path(tmp) / "a.wav"), 1)


def speak_cloned(text: str, reference: bytes, base_voice: str = "nova") -> dict:
    import tempfile
    base = base64.b64decode(synthesize(text, base_voice)["audio_base64"])
    with _convert_lock, tempfile.TemporaryDirectory() as tmp:
        conv = _openvoice()
        src, ref, out = Path(tmp) / "src.wav", Path(tmp) / "ref.wav", Path(tmp) / "out.wav"
        src.write_bytes(base)
        _to_wav_file(reference, ref, conv.hps.data.sampling_rate)
        src_se = conv.extract_se([str(src)])
        tgt_se = conv.extract_se([str(ref)])
        conv.convert(audio_src_path=str(src), src_se=src_se, tgt_se=tgt_se, output_path=str(out))
        return {"audio_base64": base64.b64encode(out.read_bytes()).decode(), "mime": "audio/wav"}


def busy_3d() -> bool:
    return _shape_lock.locked()


# ---------- video (keyframes + motion) ----------
VIDEO_FPS = 24
VIDEO_BEATS = ["establishing wide shot", "medium shot", "close-up detail shot", "dynamic low angle",
               "sweeping side view", "final hero shot"]


def _ken_burns(img, t: float, k: int, size):
    from PIL import Image
    w, h = size
    zoom = 1.0 + 0.10 * t if k % 2 == 0 else 1.10 - 0.10 * t
    cw, ch = w / zoom, h / zoom
    dx = (w - cw) * (0.5 + 0.4 * (t - 0.5) * (1 if k % 3 else -1))
    dy = (h - ch) * 0.5
    return img.crop((dx, dy, dx + cw, dy + ch)).resize(size, Image.BICUBIC)


def generate_video(prompt: str, duration: int, style: str = "") -> bytes:
    import tempfile
    import av
    import numpy as np
    from PIL import Image
    size = ASPECTS["16:9"]
    n = max(2, round(duration / 2.5))
    keys = []
    with _heavy_lock, _image_lock:
        _claim("image")
        t2i, i2i = _pipes()
        full = lambda b: f"{prompt}, {b}, {style}".strip(", ")  # noqa: E731
        img = t2i(prompt=full(VIDEO_BEATS[0]), num_inference_steps=1, guidance_scale=0.0,
                  width=size[0], height=size[1]).images[0]
        keys.append(img)
        for k in range(1, n):
            img = i2i(prompt=full(VIDEO_BEATS[k % len(VIDEO_BEATS)]), image=img, num_inference_steps=2,
                      strength=0.55, guidance_scale=0.0).images[0].resize(size)
            keys.append(img)
    total, fade = duration * VIDEO_FPS, VIDEO_FPS // 2
    seg = total / n
    with tempfile.NamedTemporaryFile(suffix=".mp4") as tmp:
        with av.open(tmp.name, "w") as out:
            st = out.add_stream("libx264", rate=VIDEO_FPS, options={"crf": "22", "preset": "veryfast"})
            st.width, st.height, st.pix_fmt = size[0], size[1], "yuv420p"
            for f in range(total):
                k = min(n - 1, int(f / seg))
                t = (f - k * seg) / seg
                frame = _ken_burns(keys[k], t, k, size)
                remaining = (k + 1) * seg - f
                if k < n - 1 and remaining < fade:
                    nxt = _ken_burns(keys[k + 1], 0.0, k + 1, size)
                    frame = Image.blend(frame, nxt, 1 - remaining / fade)
                vf = av.VideoFrame.from_ndarray(np.asarray(frame.convert("RGB")), format="rgb24")
                for p in st.encode(vf):
                    out.mux(p)
            for p in st.encode():
                out.mux(p)
        return Path(tmp.name).read_bytes()


# ---------- music ----------
_music = None
_music_lock = threading.Lock()
MUSIC_MODEL = "facebook/musicgen-small"


def generate_music(prompt: str, duration: int) -> bytes:
    global _music
    import numpy as np
    with _heavy_lock, _music_lock:
        _claim("music")
        if _music is None:
            import torch
            from transformers import AutoProcessor, MusicgenForConditionalGeneration
            torch.set_num_threads(cpu_threads())
            cache = str(SCRATCH_MODELS_DIR / "hf")
            _music = (AutoProcessor.from_pretrained(MUSIC_MODEL, cache_dir=cache),
                      MusicgenForConditionalGeneration.from_pretrained(MUSIC_MODEL, cache_dir=cache))
        proc, model = _music
        inputs = proc(text=[prompt], padding=True, return_tensors="pt")
        audio = model.generate(**inputs, max_new_tokens=int(duration * 50) + 4, do_sample=True, guidance_scale=3.0)
        rate = model.config.audio_encoder.sampling_rate
    pcm = (np.clip(audio[0, 0].numpy(), -1, 1) * 32767).astype("<i2")
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(rate)
        wf.writeframes(pcm.tobytes())
    return buf.getvalue()
