"""Backend tests for Luchii mark endpoints (iteration 14)."""
import os
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else "https://frasberg-secure-1.preview.emergentagent.com"


def test_share_includes_kind():
    r = requests.get(f"{BASE_URL}/api/share/TEST-mark-img", timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["id"] == "TEST-mark-img"
    assert "kind" in d
    assert d["kind"] == "edit"


def test_media_video_download_success():
    r = requests.get(f"{BASE_URL}/api/media/TEST-mark-video/download", timeout=120)
    assert r.status_code == 200, r.text[:400]
    assert r.headers.get("content-type", "").startswith("video/mp4")
    cd = r.headers.get("content-disposition", "")
    assert "attachment" in cd
    assert "luchii-video" in cd
    assert len(r.content) > 1000


def test_media_download_unknown_404():
    r = requests.get(f"{BASE_URL}/api/media/does-not-exist-xyz/download", timeout=30)
    assert r.status_code == 404
