"""Tests for Frasberg Motion Free: worker files endpoint, admin overview/notebook, and queue expiry."""
import os
import json
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path

import pytest
import requests
from pymongo import MongoClient

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://screenshot-sync-4.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"
GPU = f"{API}/gpu"


def _read_env():
    out = {}
    for line in Path("/app/backend/.env").read_text().splitlines():
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            out[k.strip()] = v.strip().strip('"')
    return out


ENV = _read_env()
WORKER_SECRET = ENV["FRASBERG_WORKER_SECRET"]
WORKER_H = {"X-Frasberg-Worker-Secret": WORKER_SECRET}

ADMIN = {"email": "admin.tester@luchiiapp.com", "password": "Admin123!"}
USER = {"email": "motion.tester@luchiiapp.com", "password": "Motion123!"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=10)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def user_token():
    return _login(USER)


# ---------- /api/gpu/worker/files/{name} ----------
class TestWorkerFiles:
    def test_requires_secret(self):
        r = requests.get(f"{GPU}/worker/files/worker.py", timeout=10)
        assert r.status_code == 401

    @pytest.mark.parametrize("name", ["worker.py", "engines.py", "prefetch.py", "requirements-gpu.txt"])
    def test_serves_known_files(self, name):
        r = requests.get(f"{GPU}/worker/files/{name}", headers=WORKER_H, timeout=10)
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("text/plain")
        assert len(r.content) > 10

    def test_unknown_name_404(self):
        r = requests.get(f"{GPU}/worker/files/bogus.py", headers=WORKER_H, timeout=10)
        assert r.status_code == 404

    def test_path_traversal_404(self):
        # URL-encoded traversal attempt
        r = requests.get(f"{GPU}/worker/files/..%2F.env", headers=WORKER_H, timeout=10)
        assert r.status_code == 404


# ---------- /api/gpu-admin/overview ----------
class TestGpuAdminOverview:
    def test_anonymous_401(self):
        r = requests.get(f"{API}/gpu-admin/overview", timeout=10)
        assert r.status_code == 401

    def test_non_admin_403(self, user_token):
        r = requests.get(f"{API}/gpu-admin/overview",
                         headers={"Authorization": f"Bearer {user_token}"}, timeout=10)
        assert r.status_code == 403

    def test_admin_returns_shape(self, admin_token):
        r = requests.get(f"{API}/gpu-admin/overview",
                         headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert set(d.keys()) >= {"workers", "jobs", "engines"}
        assert set(d["jobs"].keys()) == {"queued", "running", "completed", "failed"}
        assert isinstance(d["workers"], list)
        assert isinstance(d["engines"], list)
        assert any(e["id"] == "frasberg-motion-free" for e in d["engines"])


# ---------- /api/gpu-admin/notebook ----------
class TestGpuAdminNotebook:
    def test_anonymous_401(self):
        r = requests.get(f"{API}/gpu-admin/notebook", params={"gateway": f"{BASE}/api/gpu"}, timeout=10)
        assert r.status_code == 401

    def test_non_admin_403(self, user_token):
        r = requests.get(f"{API}/gpu-admin/notebook",
                         params={"gateway": f"{BASE}/api/gpu"},
                         headers={"Authorization": f"Bearer {user_token}"}, timeout=10)
        assert r.status_code == 403

    def test_non_https_gateway_422(self, admin_token):
        r = requests.get(f"{API}/gpu-admin/notebook",
                         params={"gateway": "http://example.com/api/gpu"},
                         headers={"Authorization": f"Bearer {admin_token}"}, timeout=10)
        assert r.status_code == 422

    def test_gateway_without_api_gpu_suffix_422(self, admin_token):
        r = requests.get(f"{API}/gpu-admin/notebook",
                         params={"gateway": "https://example.com"},
                         headers={"Authorization": f"Bearer {admin_token}"}, timeout=10)
        assert r.status_code == 422

    def test_valid_returns_ipynb(self, admin_token):
        gateway = f"{BASE}/api/gpu"
        r = requests.get(f"{API}/gpu-admin/notebook",
                         params={"gateway": gateway, "models": "frasberg-motion-free"},
                         headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
        assert r.status_code == 200
        assert "attachment" in r.headers.get("content-disposition", "").lower()
        assert "frasberg-free-gpu-worker.ipynb" in r.headers.get("content-disposition", "")
        nb = r.json()
        assert nb["nbformat"] == 4
        assert len(nb["cells"]) == 6
        # Cell 2 (index 1) should contain gateway URL + secret + models env
        cell2_src = "".join(nb["cells"][1]["source"])
        assert gateway in cell2_src
        assert WORKER_SECRET in cell2_src
        assert "FRASBERG_WORKER_MODELS" in cell2_src
        assert "frasberg-motion-free" in cell2_src


# ---------- queue expiry: 30-minute stale queued jobs become failed ----------
class TestQueueExpiry:
    def test_stale_queued_job_expires_after_requeue(self):
        mongo = MongoClient(ENV["MONGO_URL"])
        db = mongo[ENV["DB_NAME"]]
        stale_id = f"gtask_TEST_stale_{int(time.time())}"
        # Insert a queued job created > 30 minutes ago
        old = (datetime.now(timezone.utc) - timedelta(minutes=35)).isoformat()
        try:
            db.gpu_jobs.insert_one({
                "id": stale_id, "kind": "video", "model": "frasberg-motion-free",
                "status": "queued", "prompt": "stale test", "duration": 3,
                "aspect_ratio": "9:16", "mode": "text-to-video", "progress": 0.0,
                "attempts": 0, "owner": "test", "error": None, "created_at": old,
            })
            # Trigger _requeue_stale by calling /v1/engines
            r = requests.get(f"{GPU}/v1/engines", timeout=15)
            assert r.status_code == 200
            # Verify job became failed with expected error
            doc = db.gpu_jobs.find_one({"id": stale_id})
            assert doc is not None
            assert doc["status"] == "failed"
            assert doc["error"] == "No Frasberg GPU worker picked this job up in time"
        finally:
            db.gpu_jobs.delete_one({"id": stale_id})
            mongo.close()
