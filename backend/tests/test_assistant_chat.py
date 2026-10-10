"""Tests for POST /api/assistant/chat and auth smoke."""
import os
import pytest
import requests

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else "https://frasberg-secure-1.preview.emergentagent.com"
ADMIN = ("admin.tester@luchiiapp.com", "Admin123!")
MOTION = ("motion.tester@luchiiapp.com", "Motion123!")


def _login(email, password):
    r = requests.post(f"{BASE}/api/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["token"]


# ---- Auth / GPU admin smoke ----
class TestAuthAndGpuAdmin:
    def test_admin_login(self):
        tok = _login(*ADMIN)
        assert isinstance(tok, str) and len(tok) > 20

    def test_motion_login(self):
        tok = _login(*MOTION)
        assert isinstance(tok, str) and len(tok) > 20

    def test_gpu_admin_overview_admin_ok(self):
        tok = _login(*ADMIN)
        r = requests.get(f"{BASE}/api/gpu-admin/overview",
                         headers={"Authorization": f"Bearer {tok}"}, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "workers" in data and "jobs" in data and "engines" in data

    def test_gpu_admin_overview_motion_forbidden(self):
        tok = _login(*MOTION)
        r = requests.get(f"{BASE}/api/gpu-admin/overview",
                         headers={"Authorization": f"Bearer {tok}"}, timeout=20)
        assert r.status_code == 403, r.text


# ---- Assistant chat ----
class TestAssistantChat:
    def test_empty_message_422(self):
        r = requests.post(f"{BASE}/api/assistant/chat", json={"message": ""}, timeout=20)
        assert r.status_code == 422, r.text

    def test_missing_message_422(self):
        r = requests.post(f"{BASE}/api/assistant/chat", json={}, timeout=20)
        assert r.status_code == 422, r.text

    def test_chat_returns_503_turbulence(self):
        # Upstream returns turbulence; server tries all 8 keys (~up to 60s).
        r = requests.post(f"{BASE}/api/assistant/chat",
                          json={"message": "hello"}, timeout=120)
        assert r.status_code == 503, f"Expected 503, got {r.status_code}: {r.text[:300]}"
        detail = r.json().get("detail", "")
        assert "turbulence" in detail.lower(), f"Unexpected detail: {detail}"
