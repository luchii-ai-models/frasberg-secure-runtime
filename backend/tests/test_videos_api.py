"""Tests for GET /api/videos and GET /api/videos/{id} and legacy engine label mapping."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback: read frontend/.env directly
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")

API = f"{BASE_URL}/api"
TEST_EMAIL = "motion.tester@luchiiapp.com"
TEST_PASS = "Motion123!"
VID_93 = "eff23281-ece7-4bde-a624-80fe892fae2d"  # 9:16 Motion Pro image-to-video
VID_LITE = "cfde8c3d-434b-450c-a7a9-6940987fe8bc"  # 16:9 Lite text-to-video


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{API}/auth/login", json={"email": TEST_EMAIL, "password": TEST_PASS})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def test_videos_requires_auth():
    r = requests.get(f"{API}/videos")
    assert r.status_code == 401


def test_videos_list_ok(auth_headers):
    r = requests.get(f"{API}/videos", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert len(data) >= 2
    ids = [v["id"] for v in data]
    assert VID_93 in ids and VID_LITE in ids
    # Newest first ordering
    times = [v.get("created_at") for v in data if v.get("created_at")]
    assert times == sorted(times, reverse=True)
    # Shape of each entry
    v = data[0]
    for k in ("id", "prompt", "style", "duration", "engine", "model", "mode", "aspect_ratio", "url", "created_at"):
        assert k in v, f"missing key {k}"
    assert v["url"] == f"/api/media/{v['id']}"


def test_videos_mode_mapping(auth_headers):
    r = requests.get(f"{API}/videos", headers=auth_headers)
    by_id = {v["id"]: v for v in r.json()}
    assert by_id[VID_93]["mode"] == "image-to-video"
    assert by_id[VID_93]["aspect_ratio"] == "9:16"
    assert by_id[VID_LITE]["mode"] == "text-to-video"
    assert by_id[VID_LITE]["aspect_ratio"] == "16:9"


def test_legacy_engine_label(auth_headers):
    r = requests.get(f"{API}/videos", headers=auth_headers)
    by_id = {v["id"]: v for v in r.json()}
    # luchii-local should map to Frasberg Lite (CPU)
    assert by_id[VID_LITE]["engine"] == "Frasberg Lite (CPU)"


def test_get_video_public_ok():
    r = requests.get(f"{API}/videos/{VID_93}")
    assert r.status_code == 200
    v = r.json()
    assert v["id"] == VID_93
    assert v["mode"] == "image-to-video"
    assert v["aspect_ratio"] == "9:16"
    assert v["url"] == f"/api/media/{VID_93}"


def test_get_video_lite_public():
    r = requests.get(f"{API}/videos/{VID_LITE}")
    assert r.status_code == 200
    v = r.json()
    assert v["engine"] == "Frasberg Lite (CPU)"
    assert v["mode"] == "text-to-video"


def test_get_video_404():
    r = requests.get(f"{API}/videos/does-not-exist-xyz")
    assert r.status_code == 404


def test_media_stream_ok():
    r = requests.get(f"{API}/media/{VID_93}")
    assert r.status_code == 200
    assert r.headers.get("content-type", "").startswith("video/") or "mp4" in r.headers.get("content-type", "")
    assert len(r.content) > 1000
