"""Tests for POST /api/assistant/chat and auth smoke."""
import os
import pytest
import requests

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else "https://screenshot-sync-4.preview.emergentagent.com"
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
