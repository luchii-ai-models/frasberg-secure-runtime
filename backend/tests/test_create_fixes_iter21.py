"""Iteration 21 - verify /create backend fixes: auto_model routing per style/prompt,
remove-bg job returns transparent PNG, edit job accepts style."""
import os, time, base64, io, uuid
import pytest, requests
from PIL import Image

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"
SID = f"TEST_iter21_{uuid.uuid4().hex[:8]}"


def _tiny_png_b64():
    im = Image.new("RGB", (64, 64), (200, 120, 60))
    buf = io.BytesIO(); im.save(buf, "PNG")
    return base64.b64encode(buf.getvalue()).decode()


def _poll(job_id, timeout=360):
    deadline = time.time() + timeout
    while time.time() < deadline:
        r = requests.get(f"{BASE}/image-jobs/{job_id}", timeout=30)
        assert r.status_code == 200, r.text
        s = r.json()
        if s["status"] == "completed":
            return s
        if s["status"] == "failed":
            pytest.fail(f"job failed: {s.get('error')}")
        time.sleep(3)
    pytest.fail("job timed out")


@pytest.mark.parametrize("style,prompt,expected", [
    ("anime", "a knight on a hill", "Luchii Dreamline"),
    ("3d", "a glossy sphere", "Luchii Vision"),
    (None, "portrait of a man", "Luchii Nova-Muse"),
])
def test_auto_model_routing(style, prompt, expected):
    body = {"prompt": prompt, "session_id": SID, "aspect_ratio": "1:1"}
    if style:
        body["style"] = style
    r = requests.post(f"{BASE}/generate/jobs", json=body, timeout=30)
    assert r.status_code == 200, r.text
    job_id = r.json()["job_id"]
    s = _poll(job_id, timeout=360)
    result = s["result"]
    assert result["model"] == expected, f"expected {expected} got {result.get('model')} for style={style} prompt={prompt!r}"
    assert result.get("image_base64"), "result missing image_base64"


def test_remove_bg_job_returns_png():
    body = {"image_base64": _tiny_png_b64(), "session_id": SID}
    r = requests.post(f"{BASE}/remove-bg/jobs", json=body, timeout=30)
    assert r.status_code == 200, r.text
    job_id = r.json()["job_id"]
    s = _poll(job_id, timeout=180)
    result = s["result"]
    assert result["kind"] == "cutout"
    assert result["model"] == "Luchii Prime"
    img_b64 = result["image_base64"]
    assert img_b64, "no image returned"
    # strip data url prefix if any
    if "," in img_b64:
        img_b64 = img_b64.split(",", 1)[1]
    data = base64.b64decode(img_b64)
    assert data[:8] == b"\x89PNG\r\n\x1a\n", "cutout should be PNG"
    im = Image.open(io.BytesIO(data))
    assert im.mode in ("RGBA", "LA", "P"), f"png not transparent, mode={im.mode}"


def test_edit_job_accepts_style():
    body = {"prompt": "make it a snowy winter night", "image_base64": _tiny_png_b64(),
            "session_id": SID, "style": "cinematic"}
    r = requests.post(f"{BASE}/edit/jobs", json=body, timeout=30)
    assert r.status_code == 200, r.text
    job_id = r.json()["job_id"]
    s = _poll(job_id, timeout=360)
    result = s["result"]
    assert result["kind"] == "edit"
    assert result["model"] == "Luchii Painter-X"
    assert result.get("image_base64"), "edit result missing image"
    assert result.get("style") == "cinematic"
