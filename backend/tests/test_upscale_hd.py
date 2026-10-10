"""Iteration 20 tests - focused on review request:

- POST /api/upscale/jobs -> result image long-edge is 3840 (true 4K) and JPEG
- GET /api/generations?session_id= returns `has_full` + a small preview `image_base64` for 4K items
- GET /api/share/{id} returns the FULL (not preview) image
- Verify long edge of upscale result > long edge of input preview served from /generations
"""
import base64
import io
import os
import time

import pytest
import requests
from PIL import Image


def _load_backend_url():
    v = os.environ.get("REACT_APP_BACKEND_URL")
    if v:
        return v.rstrip("/")
    for line in open("/app/frontend/.env"):
        if line.startswith("REACT_APP_BACKEND_URL="):
            return line.split("=", 1)[1].strip().rstrip("/")
    raise RuntimeError("REACT_APP_BACKEND_URL not set")


BASE_URL = _load_backend_url()
USER = {"email": "motion.tester@luchiiapp.com", "password": "Motion123!"}
SESSION = "iter20-upscale-hd"


@pytest.fixture(scope="module")
def auth():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=USER, timeout=30)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="module")
def input_png_b64():
    import random
    random.seed(42)
    buf = io.BytesIO()
    # Use noise so the 4K JPEG output exceeds the 900k-char has_full threshold
    img = Image.new("RGB", (256, 256))
    img.putdata([(random.randint(0, 255), random.randint(0, 255), random.randint(0, 255))
                 for _ in range(256 * 256)])
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def _decode_dims(data_url: str):
    raw = base64.b64decode(data_url.split(",", 1)[1])
    img = Image.open(io.BytesIO(raw))
    return img.size, img.format, len(raw)


def _poll(jid, timeout_s, headers):
    start = time.time()
    last = None
    while time.time() - start < timeout_s:
        r = requests.get(f"{BASE_URL}/api/image-jobs/{jid}", headers=headers, timeout=30)
        assert r.status_code == 200, r.text
        last = r.json()
        if last["status"] in ("completed", "failed"):
            return last
        time.sleep(6)
    pytest.fail(f"Job {jid} not finished in {timeout_s}s; last={last}")


class TestUpscale4KPipeline:
    def test_upscale_job_produces_true_4k(self, auth, input_png_b64):
        r = requests.post(
            f"{BASE_URL}/api/upscale/jobs",
            json={"image_base64": input_png_b64, "prompt": "Upscale", "session_id": SESSION},
            headers=auth, timeout=30,
        )
        assert r.status_code == 200, r.text
        jid = r.json()["job_id"]
        done = _poll(jid, 360, auth)
        assert done["status"] == "completed", done
        img_url = done["result"]["image_base64"]
        assert img_url.startswith("data:image/"), img_url[:40]
        (w, h), fmt, nbytes = _decode_dims(img_url)
        assert fmt == "JPEG", f"4K output should be JPEG, got {fmt}"
        assert max(w, h) == 3840, f"long edge should be 3840 (true 4K UHD), got {w}x{h}"
        # stash for next tests
        pytest.gen_id = done["result"]["id"]
        pytest.full_dims = (w, h)
        pytest.full_bytes = nbytes

    def test_generations_list_returns_preview_with_has_full(self, auth):
        gen_id = getattr(pytest, "gen_id", None)
        assert gen_id, "upscale test must run first"
        r = requests.get(f"{BASE_URL}/api/generations?session_id={SESSION}&limit=20",
                         headers=auth, timeout=30)
        assert r.status_code == 200, r.text
        items = r.json()
        hit = next((it for it in items if it["id"] == gen_id), None)
        assert hit, f"gen {gen_id} not in list {[(i['id'], i.get('kind')) for i in items]}"
        # 4K upscales exceed LIST_THUMB_OVER (900k chars) so has_full should be True
        assert hit.get("has_full") is True, f"has_full missing for 4K list item: {hit.keys()}"
        assert hit["image_base64"].startswith("data:image/"), "preview image missing"
        (pw, ph), fmt, nbytes = _decode_dims(hit["image_base64"])
        # preview() thumbnails to 768
        assert max(pw, ph) <= 768, f"preview should be <=768 long edge, got {pw}x{ph}"
        full_w, full_h = pytest.full_dims
        assert max(pw, ph) < max(full_w, full_h), "preview should be smaller than full"

    def test_share_returns_full_4k_image(self):
        gen_id = getattr(pytest, "gen_id", None)
        assert gen_id, "upscale test must run first"
        r = requests.get(f"{BASE_URL}/api/share/{gen_id}", timeout=30)
        assert r.status_code == 200, r.text
        doc = r.json()
        assert doc["id"] == gen_id
        assert doc["image_base64"].startswith("data:image/")
        (w, h), fmt, nbytes = _decode_dims(doc["image_base64"])
        assert max(w, h) == 3840, f"share should return full 4K, got {w}x{h}"
        assert nbytes >= pytest.full_bytes - 100  # same JPEG

    def test_share_404(self):
        r = requests.get(f"{BASE_URL}/api/share/does-not-exist", timeout=20)
        assert r.status_code == 404
