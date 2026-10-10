"""Image async job tests (iteration 19).

Covers:
- POST /api/generate/jobs (Luchii Vision - fast, Luchii Dreamline, Luchii Nova-Muse photoreal)
- GET /api/image-jobs/{id}
- POST /api/edit/jobs, POST /api/upscale/jobs
- Regression: old sync /api/generate for Luchii Vision
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
    env_path = "/app/frontend/.env"
    if os.path.exists(env_path):
        for line in open(env_path):
            if line.startswith("REACT_APP_BACKEND_URL="):
                return line.split("=", 1)[1].strip().rstrip("/")
    raise RuntimeError("REACT_APP_BACKEND_URL not set")


BASE_URL = _load_backend_url()
USER = {"email": "motion.tester@luchiiapp.com", "password": "Motion123!"}


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=USER, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def tiny_png_b64():
    buf = io.BytesIO()
    Image.new("RGB", (64, 64), (120, 90, 200)).save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


# ---------- helpers ----------
def _poll_job(jid, max_s, headers=None):
    start = time.time()
    last = None
    while time.time() - start < max_s:
        r = requests.get(f"{BASE_URL}/api/image-jobs/{jid}", headers=headers or {}, timeout=30)
        assert r.status_code == 200, r.text
        last = r.json()
        if last["status"] in ("completed", "failed"):
            return last
        time.sleep(5)
    pytest.fail(f"Job {jid} did not finish in {max_s}s; last status={last}")


# ---------- tests ----------
class TestImageJobs:
    def test_image_job_404(self):
        r = requests.get(f"{BASE_URL}/api/image-jobs/00000000-0000-0000-0000-000000000000", timeout=20)
        assert r.status_code == 404

    def test_sync_generate_vision_regression(self):
        # Old sync endpoint should still work for the fast Vision model
        r = requests.post(
            f"{BASE_URL}/api/generate",
            json={"prompt": "a tiny red cube on a white table", "model": "Luchii Vision",
                  "style": "cinematic", "aspect_ratio": "1:1", "session_id": "test-sync-vision"},
            timeout=180,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["model"] == "Luchii Vision"
        assert data["image_base64"] and data["image_base64"].startswith("data:image/")

    def test_generate_job_vision_fast(self, auth_headers):
        r = requests.post(
            f"{BASE_URL}/api/generate/jobs",
            json={"prompt": "small blue teapot on wooden table", "model": "Luchii Vision",
                  "style": "photorealistic", "aspect_ratio": "1:1", "session_id": "test-job-vision"},
            headers=auth_headers, timeout=30,
        )
        assert r.status_code == 200, r.text
        jid = r.json()["job_id"]
        assert r.json()["status"] == "queued"
        done = _poll_job(jid, max_s=180, headers=auth_headers)
        assert done["status"] == "completed", done
        assert done["result"]["image_base64"].startswith("data:image/")
        assert done["result"]["model"] == "Luchii Vision"

    def test_generate_job_dreamline(self, auth_headers):
        r = requests.post(
            f"{BASE_URL}/api/generate/jobs",
            json={"prompt": "painterly sunset over mountains, vivid colors", "model": "Luchii Dreamline",
                  "style": "digital-art", "aspect_ratio": "1:1", "session_id": "test-job-dream"},
            headers=auth_headers, timeout=30,
        )
        assert r.status_code == 200
        jid = r.json()["job_id"]
        done = _poll_job(jid, max_s=240, headers=auth_headers)
        assert done["status"] == "completed", done
        assert done["result"]["model"] == "Luchii Dreamline"
        gen_id = done["result"]["id"]
        # verify persisted in user's /my/generations
        mg = requests.get(f"{BASE_URL}/api/my/generations?limit=60", headers=auth_headers, timeout=30)
        assert mg.status_code == 200
        ids = [g["id"] for g in mg.json()]
        assert gen_id in ids

    def test_upscale_job(self, auth_headers, tiny_png_b64):
        r = requests.post(
            f"{BASE_URL}/api/upscale/jobs",
            json={"image_base64": tiny_png_b64, "prompt": "Upscale", "session_id": "test-upscale"},
            headers=auth_headers, timeout=30,
        )
        assert r.status_code == 200, r.text
        jid = r.json()["job_id"]
        done = _poll_job(jid, max_s=240, headers=auth_headers)
        assert done["status"] == "completed", done
        assert done["result"]["image_base64"].startswith("data:image/")

    def test_edit_job(self, auth_headers, tiny_png_b64):
        r = requests.post(
            f"{BASE_URL}/api/edit/jobs",
            json={"image_base64": tiny_png_b64, "prompt": "make it look like neon cyberpunk", "session_id": "test-edit"},
            headers=auth_headers, timeout=30,
        )
        assert r.status_code == 200, r.text
        jid = r.json()["job_id"]
        done = _poll_job(jid, max_s=240, headers=auth_headers)
        assert done["status"] == "completed", done
        assert done["result"]["image_base64"].startswith("data:image/")

    def test_generate_job_nova_muse_photoreal(self, auth_headers):
        """Heavy test - photoreal engine ~2min. Allow up to 6 min."""
        r = requests.post(
            f"{BASE_URL}/api/generate/jobs",
            json={"prompt": "portrait of a woman in golden hour light, 85mm", "model": "Luchii Nova-Muse",
                  "style": "photorealistic", "aspect_ratio": "1:1", "session_id": "test-job-nova"},
            headers=auth_headers, timeout=30,
        )
        assert r.status_code == 200
        jid = r.json()["job_id"]
        done = _poll_job(jid, max_s=360, headers=auth_headers)
        assert done["status"] == "completed", done
        assert done["result"]["model"] == "Luchii Nova-Muse"
        assert done["result"]["image_base64"].startswith("data:image/")
