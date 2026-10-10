"""Luchii Prime: real super-resolution (Real-ESRGAN, BSD-3) in pure PyTorch, no extra dependencies.

* "prime"   -> RealESRGAN_x4plus (RRDBNet, 64MB). Best detail, used for "Upscale to 4K".
* "compact" -> realesr-general-x4v3 (SRVGGNetCompact, 5MB). ~20x faster, used to sharpen every
  512px render (Nova-Muse, Dreamline, Vision, Painter-X) into a crisp HD image.
Weights live on the persistent volume (LUCHII_MODELS_DIR/sr) and download once from the
official Real-ESRGAN GitHub releases.
"""
import logging
import os
import threading
from pathlib import Path

import httpx
import torch
import torch.nn as nn
import torch.nn.functional as F

logger = logging.getLogger("luchii.sr")
SR_DIR = Path(os.environ["LUCHII_MODELS_DIR"]) / "sr"
WEIGHTS = {
    "prime": ("RealESRGAN_x4plus.pth",
              "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth", "params_ema"),
    "compact": ("realesr-general-x4v3.pth",
                "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesr-general-x4v3.pth", "params"),
}
_models: dict = {}
_lock = threading.Lock()


class _RDB(nn.Module):
    def __init__(self, nf=64, gc=32):
        super().__init__()
        self.conv1 = nn.Conv2d(nf, gc, 3, 1, 1)
        self.conv2 = nn.Conv2d(nf + gc, gc, 3, 1, 1)
        self.conv3 = nn.Conv2d(nf + 2 * gc, gc, 3, 1, 1)
        self.conv4 = nn.Conv2d(nf + 3 * gc, gc, 3, 1, 1)
        self.conv5 = nn.Conv2d(nf + 4 * gc, nf, 3, 1, 1)
        self.lrelu = nn.LeakyReLU(0.2, inplace=True)

    def forward(self, x):
        x1 = self.lrelu(self.conv1(x))
        x2 = self.lrelu(self.conv2(torch.cat((x, x1), 1)))
        x3 = self.lrelu(self.conv3(torch.cat((x, x1, x2), 1)))
        x4 = self.lrelu(self.conv4(torch.cat((x, x1, x2, x3), 1)))
        return self.conv5(torch.cat((x, x1, x2, x3, x4), 1)) * 0.2 + x


class _RRDB(nn.Module):
    def __init__(self, nf=64, gc=32):
        super().__init__()
        self.rdb1, self.rdb2, self.rdb3 = _RDB(nf, gc), _RDB(nf, gc), _RDB(nf, gc)

    def forward(self, x):
        return self.rdb3(self.rdb2(self.rdb1(x))) * 0.2 + x


class RRDBNet(nn.Module):
    def __init__(self, nf=64, nb=23, gc=32):
        super().__init__()
        self.conv_first = nn.Conv2d(3, nf, 3, 1, 1)
        self.body = nn.Sequential(*[_RRDB(nf, gc) for _ in range(nb)])
        self.conv_body = nn.Conv2d(nf, nf, 3, 1, 1)
        self.conv_up1 = nn.Conv2d(nf, nf, 3, 1, 1)
        self.conv_up2 = nn.Conv2d(nf, nf, 3, 1, 1)
        self.conv_hr = nn.Conv2d(nf, nf, 3, 1, 1)
        self.conv_last = nn.Conv2d(nf, 3, 3, 1, 1)
        self.lrelu = nn.LeakyReLU(0.2, inplace=True)

    def forward(self, x):
        feat = self.conv_first(x)
        feat = feat + self.conv_body(self.body(feat))
        feat = self.lrelu(self.conv_up1(F.interpolate(feat, scale_factor=2, mode="nearest")))
        feat = self.lrelu(self.conv_up2(F.interpolate(feat, scale_factor=2, mode="nearest")))
        return self.conv_last(self.lrelu(self.conv_hr(feat)))


class SRVGGNetCompact(nn.Module):
    def __init__(self, nf=64, nc=32, scale=4):
        super().__init__()
        self.scale = scale
        layers = [nn.Conv2d(3, nf, 3, 1, 1), nn.PReLU(num_parameters=nf)]
        for _ in range(nc):
            layers += [nn.Conv2d(nf, nf, 3, 1, 1), nn.PReLU(num_parameters=nf)]
        layers.append(nn.Conv2d(nf, 3 * scale * scale, 3, 1, 1))
        self.body = nn.ModuleList(layers)
        self.upsampler = nn.PixelShuffle(scale)

    def forward(self, x):
        out = x
        for layer in self.body:
            out = layer(out)
        return self.upsampler(out) + F.interpolate(x, scale_factor=self.scale, mode="nearest")


def _weights(kind: str) -> Path:
    name, url, _ = WEIGHTS[kind]
    path = SR_DIR / name
    if not path.exists():
        SR_DIR.mkdir(parents=True, exist_ok=True)
        logger.info("Downloading Luchii Prime weights %s", url)
        tmp = path.with_suffix(".part")
        with httpx.stream("GET", url, follow_redirects=True, timeout=300) as r:
            r.raise_for_status()
            with open(tmp, "wb") as f:
                for chunk in r.iter_bytes():
                    f.write(chunk)
        tmp.rename(path)
    return path


def _model(kind: str):
    if kind not in _models:
        net = RRDBNet() if kind == "prime" else SRVGGNetCompact()
        state = torch.load(_weights(kind), map_location="cpu", weights_only=True)
        net.load_state_dict(state.get(WEIGHTS[kind][2], state), strict=True)
        _models[kind] = net.eval()
        logger.info("Luchii Prime SR engine '%s' loaded", kind)
    return _models[kind]


@torch.inference_mode()
def upscale4x(img, kind: str = "compact", tile: int = 192, pad: int = 12):
    """PIL RGB image -> PIL image at 4x, processed in overlapping tiles to keep memory flat."""
    import numpy as np
    from PIL import Image
    with _lock:
        net = _model(kind)
        x = torch.from_numpy(np.asarray(img.convert("RGB"), dtype=np.float32) / 255.0).permute(2, 0, 1)[None]
        _, _, h, w = x.shape
        out = torch.zeros((1, 3, h * 4, w * 4))
        for y0 in range(0, h, tile):
            for x0 in range(0, w, tile):
                y1, x1 = min(y0 + tile, h), min(x0 + tile, w)
                py0, px0, py1, px1 = max(y0 - pad, 0), max(x0 - pad, 0), min(y1 + pad, h), min(x1 + pad, w)
                res = net(x[:, :, py0:py1, px0:px1])
                out[:, :, y0 * 4:y1 * 4, x0 * 4:x1 * 4] = res[:, :, (y0 - py0) * 4:(y0 - py0 + y1 - y0) * 4,
                                                              (x0 - px0) * 4:(x0 - px0 + x1 - x0) * 4]
        arr = (out[0].clamp(0, 1).permute(1, 2, 0).numpy() * 255.0).round().astype("uint8")
    return Image.fromarray(arr)


def enhance(img, longest: int, kind: str = "compact"):
    """Super-resolve then resample to the target longest edge (Lanczos)."""
    from PIL import Image
    big = upscale4x(img, kind)
    scale = longest / max(big.size)
    if abs(scale - 1) > 0.01:
        big = big.resize((max(1, round(big.width * scale)), max(1, round(big.height * scale))), Image.LANCZOS)
    return big
