"""Frasberg engine implementations (diffusers). One model is resident at a time.

frasberg-motion-fast   LTX-Video 0.9.7 distilled + spatial latent upscaler (2-stage, guidance-distilled)
frasberg-motion-pro    Wan 2.2 TI2V-5B (text- and image-to-video, 720p/24fps)
frasberg-motion-ultra  HunyuanVideo 13B (T2V) / HunyuanVideo-I2V
frasberg-image         FLUX.1-schnell (4 steps)
frasberg-dev-test      procedural test pattern (CPU, protocol self-test only)
"""
import gc
import io
import os
import tempfile
import threading

MIN_VRAM = {"frasberg-motion-fast": 24, "frasberg-motion-pro": 24, "frasberg-motion-ultra": 80,
            "frasberg-image": 16, "frasberg-dev-test": 0}

REPOS = {
    "frasberg-motion-fast": ("Lightricks/LTX-Video-0.9.7-distilled", "Lightricks/ltxv-spatial-upscaler-0.9.7"),
    "frasberg-motion-pro": ("Wan-AI/Wan2.2-TI2V-5B-Diffusers",),
    "frasberg-motion-ultra": ("hunyuanvideo-community/HunyuanVideo", "hunyuanvideo-community/HunyuanVideo-I2V"),
    "frasberg-image": ("black-forest-labs/FLUX.1-schnell",),
}
NEGATIVE = "worst quality, inconsistent motion, blurry, jittery, distorted, watermark, text, deformed"

_lock = threading.RLock()
_loaded = {"model": None, "pipes": None}


def gpu_info():
    try:
        import torch
        if torch.cuda.is_available():
            p = torch.cuda.get_device_properties(0)
            return p.name, round(p.total_memory / 1024 ** 3, 1)
    except Exception:  # noqa: BLE001
        pass
    return None, 0.0


def loaded_model():
    return _loaded["model"]


def unload():
    with _lock:
        _loaded.update(model=None, pipes=None)
        gc.collect()
        try:
            import torch
            torch.cuda.empty_cache()
        except Exception:  # noqa: BLE001
            pass


def _place(pipe, model):
    """Fully on GPU when VRAM allows, otherwise model-level CPU offload."""
    vram = gpu_info()[1]
    if vram >= MIN_VRAM[model] * 1.5:
        return pipe.to("cuda")
    pipe.enable_model_cpu_offload()
    return pipe


def _load(model):
    import torch
    bf16 = torch.bfloat16
    if model == "frasberg-motion-fast":
        from diffusers import LTXConditionPipeline, LTXLatentUpsamplePipeline
        base = LTXConditionPipeline.from_pretrained(REPOS[model][0], torch_dtype=bf16)
        up = LTXLatentUpsamplePipeline.from_pretrained(REPOS[model][1], vae=base.vae, torch_dtype=bf16)
        base.vae.enable_tiling()
        return {"base": _place(base, model), "up": _place(up, model)}
    if model == "frasberg-motion-pro":
        from diffusers import AutoencoderKLWan, WanPipeline
        vae = AutoencoderKLWan.from_pretrained(REPOS[model][0], subfolder="vae", torch_dtype=torch.float32)
        return {"pipe": _place(WanPipeline.from_pretrained(REPOS[model][0], vae=vae, torch_dtype=bf16), model)}
    if model == "frasberg-motion-ultra":
        from diffusers import HunyuanVideoPipeline
        t2v = HunyuanVideoPipeline.from_pretrained(REPOS[model][0], torch_dtype=bf16)
        t2v.vae.enable_tiling()
        return {"t2v": _place(t2v, model), "i2v": None}
    if model == "frasberg-image":
        from diffusers import FluxPipeline
        return {"pipe": _place(FluxPipeline.from_pretrained(REPOS[model][0], torch_dtype=bf16), model)}
    if model == "frasberg-dev-test":
        return {}
    raise ValueError(f"Unknown Frasberg engine {model}")


def _pipes(model):
    if _loaded["model"] != model:
        unload()
        _loaded.update(model=model, pipes=_load(model))
    return _loaded["pipes"]


def _size(aspect, long_side, short_side, mult):
    h, w = {"16:9": (short_side, long_side), "9:16": (long_side, short_side)}.get(aspect, (short_side, short_side))
    return h - h % mult, w - w % mult


def _frames(duration, fps, step, cap):
    n = min(int(duration * fps), cap)
    return (n // step) * step + 1


def _gen(seed):
    import torch
    return torch.Generator("cpu").manual_seed(int(seed)) if seed is not None else None


def _cb(progress, total, offset=0.0, span=1.0):
    def cb(pipe, step, t, kw):
        progress(offset + span * (step + 1) / max(total, 1))
        return kw
    return cb


def _mp4(frames, fps):
    from diffusers.utils import export_to_video
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as f:
        path = f.name
    try:
        export_to_video(frames, path, fps=fps)
        with open(path, "rb") as fh:
            return fh.read()
    finally:
        os.unlink(path)


def _fit(image, h, w):
    from PIL import ImageOps
    return ImageOps.fit(image, (w, h)) if image is not None else None


def render(model, *, prompt, negative_prompt=None, duration=5, aspect_ratio="16:9", seed=None, image=None,
           progress=lambda p: None):
    with _lock:
        pipes = _pipes(model)
        neg = negative_prompt or NEGATIVE
        if model == "frasberg-motion-fast":
            return _ltx(pipes, prompt, neg, duration, aspect_ratio, seed, image, progress), "video/mp4"
        if model == "frasberg-motion-pro":
            h, w = _size(aspect_ratio, 1280, 704, 32)
            n = _frames(duration, 24, 4, 120)
            p = pipes["pipe"]
            kw = {"image": _fit(image, h, w)} if image is not None else {}
            frames = p(prompt=prompt, negative_prompt=neg, height=h, width=w, num_frames=n, num_inference_steps=40,
                       guidance_scale=5.0, generator=_gen(seed), callback_on_step_end=_cb(progress, 40), **kw).frames[0]
            return _mp4(frames, 24), "video/mp4"
        if model == "frasberg-motion-ultra":
            h, w = _size(aspect_ratio, 1280, 720, 16)
            n = _frames(duration, 24, 4, 128)
            if image is not None:
                if pipes["i2v"] is None:
                    import torch
                    from diffusers import HunyuanVideoImageToVideoPipeline
                    pipes["t2v"] = None
                    gc.collect()
                    torch.cuda.empty_cache()
                    i2v = HunyuanVideoImageToVideoPipeline.from_pretrained(REPOS[model][1], torch_dtype=torch.bfloat16)
                    i2v.vae.enable_tiling()
                    pipes["i2v"] = _place(i2v, model)
                frames = pipes["i2v"](image=_fit(image, h, w), prompt=prompt, height=h, width=w, num_frames=n,
                                      num_inference_steps=50, generator=_gen(seed),
                                      callback_on_step_end=_cb(progress, 50)).frames[0]
            else:
                if pipes["t2v"] is None:
                    unload()
                    pipes = _pipes(model)
                frames = pipes["t2v"](prompt=prompt, height=h, width=w, num_frames=n, num_inference_steps=50,
                                      guidance_scale=6.0, generator=_gen(seed),
                                      callback_on_step_end=_cb(progress, 50)).frames[0]
            return _mp4(frames, 24), "video/mp4"
        if model == "frasberg-image":
            h, w = _size(aspect_ratio, 1344, 768, 64) if aspect_ratio in ("16:9", "9:16") else (1024, 1024)
            img = pipes["pipe"](prompt=prompt, height=h, width=w, num_inference_steps=4, guidance_scale=0.0,
                                max_sequence_length=256, generator=_gen(seed),
                                callback_on_step_end=_cb(progress, 4)).images[0]
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            return buf.getvalue(), "image/png"
        if model == "frasberg-dev-test":
            return _dev_test(prompt, duration, image, progress), "video/mp4"
    raise ValueError(f"Unknown Frasberg engine {model}")


def _ltx(pipes, prompt, neg, duration, aspect, seed, image, progress):
    """LTX 0.9.7 distilled recipe: low-res pass -> 2x latent upscale -> short refine pass."""
    base, up = pipes["base"], pipes["up"]
    eh, ew = _size(aspect, 1152, 640, 32)
    n = _frames(duration, 24, 8, 256)
    dh, dw = int(eh * 2 / 3), int(ew * 2 / 3)
    r = base.vae_spatial_compression_ratio
    dh, dw = dh - dh % r, dw - dw % r
    cond = {}
    if image is not None:
        from diffusers.pipelines.ltx.pipeline_ltx_condition import LTXVideoCondition
        cond = {"conditions": [LTXVideoCondition(image=_fit(image, dh, dw), frame_index=0)]}
    common = dict(prompt=prompt, negative_prompt=neg, num_frames=n, decode_timestep=0.05, decode_noise_scale=0.025,
                  image_cond_noise_scale=0.0, guidance_scale=1.0, guidance_rescale=0.7, **cond)
    latents = base(width=dw, height=dh, timesteps=[1000, 993, 987, 981, 975, 909, 725, 0.03], generator=_gen(seed),
                   output_type="latent", callback_on_step_end=_cb(progress, 8, 0.0, 0.6), **common).frames
    latents = up(latents=latents, adain_factor=1.0, output_type="latent").frames
    progress(0.7)
    frames = base(width=dw * 2, height=dh * 2, denoise_strength=0.999, timesteps=[1000, 909, 725, 421, 0],
                  latents=latents, generator=_gen(seed), output_type="pil",
                  callback_on_step_end=_cb(progress, 5, 0.7, 0.3), **common).frames[0]
    frames = [f.resize((ew, eh)) for f in frames]
    return _mp4(frames, 24)


def _dev_test(prompt, duration, image, progress):
    """Protocol self-test only: a moving test pattern. Never served for a product engine."""
    import numpy as np
    from PIL import Image, ImageDraw
    frames = []
    total = max(1, int(duration)) * 12
    base = image.resize((256, 256)) if image is not None else None
    for i in range(total):
        im = base.copy() if base is not None else Image.new("RGB", (256, 256), (5, 6, 10))
        d = ImageDraw.Draw(im)
        x = int(20 + 200 * i / total)
        d.ellipse([x, 110, x + 36, 146], fill=(0, 240, 255))
        d.text((8, 8), f"FRASBERG DEV TEST {i}", fill=(255, 255, 255))
        frames.append(np.asarray(im).astype("float32") / 255.0)
        progress((i + 1) / total)
    return _mp4(frames, 12)
