"""Backend tests for Agent bundles (/api/chat/agents/bundle) and luchii_model on /api/video.

Covers:
- POST /api/chat/agents/bundle creates 3 tasks (image, video, music), ordering, 401 unauthenticated, 404 for other user.
- POST /api/video accepts luchii_model and job_out returns it; auto picks Animus with image / Cinematica without.
"""
import os
import time
import uuid
import pytest
import requests

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE}/api"

USER_A = {"email": "motion.tester@luchiiapp.com", "password": "Motion123!"}
USER_B = {"email": "admin.tester@luchiiapp.com", "password": "Admin123!"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"login failed {r.status_code} {r.text}"
    return r.json()["access_token"] if "access_token" in r.json() else r.json()["token"]


@pytest.fixture(scope="module")
def token_a():
    return _login(USER_A)


@pytest.fixture(scope="module")
def token_b():
    return _login(USER_B)


# ---------- /api/video luchii_model ----------
class TestVideoLuchiiModel:
    def test_video_auto_without_image_picks_cinematica(self, token_a):
        r = requests.post(f"{API}/video", json={
            "prompt": "TEST_bundle sunset over mountains", "duration": 5, "luchii_model": None,
        }, headers={"Authorization": f"Bearer {token_a}"}, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["luchii_model"] == "Luchii Cinematica", d
        assert "job_id" in d

    def test_video_auto_with_image_picks_animus(self, token_a):
        # 1x1 png
        img = ("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk"
               "+A8AAQUBAScY42YAAAAASUVORK5CYII=")
        r = requests.post(f"{API}/video", json={
            "prompt": "TEST_bundle photo motion", "duration": 5, "image_base64": img,
        }, headers={"Authorization": f"Bearer {token_a}"}, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["luchii_model"] == "Luchii Animus"

    def test_video_explicit_cinematica(self, token_a):
        r = requests.post(f"{API}/video", json={
            "prompt": "TEST_bundle explicit", "duration": 5, "luchii_model": "Luchii Cinematica",
        }, headers={"Authorization": f"Bearer {token_a}"}, timeout=30)
        assert r.status_code == 200
        assert r.json()["luchii_model"] == "Luchii Cinematica"


# ---------- /api/chat/agents/bundle ----------
class TestAgentBundle:
    def test_bundle_unauth_returns_401(self):
        r = requests.post(f"{API}/chat/agents/bundle", json={"idea": "TEST_bundle unauth"}, timeout=30)
        assert r.status_code == 401, r.text

    def test_bundle_create_and_order(self, token_a):
        r = requests.post(f"{API}/chat/agents/bundle",
                          json={"idea": "TEST_bundle A lighthouse on a stormy cliff at night",
                                "image_model": "Luchii Nova-Muse"},
                          headers={"Authorization": f"Bearer {token_a}"}, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "bundle_id" in d
        tasks = d["tasks"]
        assert len(tasks) == 3
        types = [t["type"] for t in tasks]
        assert set(types) == {"image", "video", "music"}
        for t in tasks:
            assert t["status"] == "queued"
            assert t["owner"]  # has owner
        pytest.bundle_id = d["bundle_id"]

    def test_bundle_status_sorted(self, token_a):
        bid = getattr(pytest, "bundle_id", None)
        assert bid, "needs previous test"
        r = requests.get(f"{API}/chat/agents/bundle/{bid}",
                         headers={"Authorization": f"Bearer {token_a}"}, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["bundle_id"] == bid
        order = [t["type"] for t in d["tasks"]]
        assert order == ["image", "video", "music"], order

    def test_bundle_other_user_404(self, token_b):
        bid = getattr(pytest, "bundle_id", None)
        assert bid
        r = requests.get(f"{API}/chat/agents/bundle/{bid}",
                         headers={"Authorization": f"Bearer {token_b}"}, timeout=30)
        assert r.status_code == 404

    def test_bundle_unknown_id_404(self, token_a):
        r = requests.get(f"{API}/chat/agents/bundle/{uuid.uuid4()}",
                         headers={"Authorization": f"Bearer {token_a}"}, timeout=30)
        assert r.status_code == 404
