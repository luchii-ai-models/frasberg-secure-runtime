"""Frasberg GPU Gateway - client API, worker auth, and full worker protocol with hidden dev-test engine."""
import os
import time
import uuid
import requests
import pytest

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://b46846a5-88ec-40b8-8362-5bce831bab47.preview.emergentagent.com").rstrip("/")
GPU = f"{BASE}/api/gpu"

# Load env from backend/.env
def _read_env():
    out = {}
    with open("/app/backend/.env") as f:
        for line in f:
            if "=" in line and not line.startswith("#"):
                k, v = line.rstrip().split("=", 1)
                out[k] = v.strip().strip('"')
    return out

ENV = _read_env()
VALID_KEY = "frb_live_a1872bf269d4b2759accd43510308eaadb930c31"
WORKER_SECRET = ENV["FRASBERG_WORKER_SECRET"]

CLIENT_H = {"Authorization": f"Bearer {VALID_KEY}", "Content-Type": "application/json"}
WORKER_H = {"X-Frasberg-Worker-Secret": WORKER_SECRET, "Content-Type": "application/json"}


# ---------- engines catalogue ----------
class TestEngines:
    def test_lists_five_visible_engines_free_first(self):
        r = requests.get(f"{GPU}/v1/engines", timeout=15)
        assert r.status_code == 200
        data = r.json()["data"]
        ids = [e["id"] for e in data]
        assert ids[0] == "frasberg-motion-free"
        assert set(ids) == {"frasberg-motion-free", "frasberg-motion-fast", "frasberg-motion-pro",
                            "frasberg-motion-ultra", "frasberg-image"}
        free = next(e for e in data if e["id"] == "frasberg-motion-free")
        assert free["tier"] == "free"
        assert free["durations"] == [3, 4]
        assert free["min_vram_gb"] == 14
        for e in data:
            for f in ["name", "kind", "tier", "modes", "durations", "status", "workers_online", "warm", "queue_depth"]:
                assert f in e, f"missing field {f} on {e['id']}"

    def test_hidden_dev_test_only_with_flag(self):
        r = requests.get(f"{GPU}/v1/engines", timeout=10).json()
        assert all(e["id"] != "frasberg-dev-test" for e in r["data"])
        r = requests.get(f"{GPU}/v1/engines?include_hidden=true", timeout=10).json()
        assert any(e["id"] == "frasberg-dev-test" for e in r["data"])


# ---------- client auth ----------
class TestClientAuth:
    def test_missing_key_returns_fk001(self):
        r = requests.post(f"{GPU}/generate/video", json={"prompt": "x", "model": "frasberg-motion-fast"}, timeout=10)
        assert r.status_code == 401
        assert r.json()["detail"]["code"] == "FK-001"

    def test_bad_key_returns_fk001(self):
        r = requests.post(f"{GPU}/generate/video",
                          headers={"Authorization": "Bearer frb_live_bogus", "Content-Type": "application/json"},
                          json={"prompt": "x", "model": "frasberg-motion-fast"}, timeout=10)
        assert r.status_code == 401
        assert r.json()["detail"]["code"] == "FK-001"

    def test_valid_key_accepted(self):
        r = requests.post(f"{GPU}/generate/video", headers=CLIENT_H,
                          json={"prompt": "test", "model": "frasberg-motion-fast", "duration": 3}, timeout=10)
        assert r.status_code == 200
        assert r.json()["status"] == "queued"

    def test_unknown_model_422(self):
        r = requests.post(f"{GPU}/generate/video", headers=CLIENT_H,
                          json={"prompt": "x", "model": "frasberg-bogus"}, timeout=10)
        assert r.status_code == 422

    def test_image_engine_rejects_start_image(self):
        # frasberg-image is kind=image, so posting to /generate/video with model=frasberg-image = kind mismatch
        r = requests.post(f"{GPU}/generate/video", headers=CLIENT_H,
                          json={"prompt": "x", "model": "frasberg-image", "image_base64": "AAAA"}, timeout=10)
        assert r.status_code == 422


# ---------- worker auth ----------
class TestWorkerAuth:
    def test_heartbeat_requires_secret(self):
        r = requests.post(f"{GPU}/worker/heartbeat", json={"worker_id": "x", "models": []}, timeout=10)
        assert r.status_code == 401

    def test_claim_requires_secret(self):
        r = requests.post(f"{GPU}/worker/claim", json={"worker_id": "x", "models": []}, timeout=10)
        assert r.status_code == 401


# ---------- full worker protocol via hidden dev-test engine ----------
class TestWorkerProtocol:
    WID = f"pytest-wk-{uuid.uuid4().hex[:6]}"

    def _heartbeat(self, models=("frasberg-dev-test",)):
        return requests.post(f"{GPU}/worker/heartbeat", headers=WORKER_H,
                             json={"worker_id": self.WID, "models": list(models)}, timeout=10)

    def test_01_submit_job(self):
        r = requests.post(f"{GPU}/generate/video", headers=CLIENT_H,
                          json={"prompt": "e2e test", "model": "frasberg-dev-test", "duration": 1,
                                "image_base64": "AAAA"}, timeout=10)
        assert r.status_code == 200
        TestWorkerProtocol.job_id = r.json()["task_id"]

    def test_02_heartbeat_makes_engine_online(self):
        assert self._heartbeat().status_code == 200
        r = requests.get(f"{GPU}/v1/engines?include_hidden=true", timeout=10).json()
        dev = next(e for e in r["data"] if e["id"] == "frasberg-dev-test")
        assert dev["workers_online"] >= 1
        assert dev["status"] == "online"

    def test_03_claim_returns_job_with_image(self):
        r = requests.post(f"{GPU}/worker/claim", headers=WORKER_H,
                          json={"worker_id": self.WID, "models": ["frasberg-dev-test"]}, timeout=10)
        assert r.status_code == 200
        job = r.json()["job"]
        assert job is not None
        assert job["id"] == self.job_id
        assert job["image_base64"] == "AAAA"
        assert job["mode"] == "image-to-video"

    def test_04_wrong_worker_cannot_progress(self):
        r = requests.post(f"{GPU}/worker/jobs/{self.job_id}/progress", headers=WORKER_H,
                          json={"worker_id": "intruder", "progress": 0.5}, timeout=10)
        assert r.status_code == 409

    def test_05_chunk_mismatch_on_complete(self):
        # upload 1 chunk but tell complete it expects 2
        data = b"\x00" * 32
        r = requests.put(f"{GPU}/worker/jobs/{self.job_id}/chunk/0", data=data,
                         headers={**WORKER_H, "X-Frasberg-Worker-Id": self.WID,
                                  "Content-Type": "application/octet-stream"}, timeout=10)
        assert r.status_code == 200
        r = requests.post(f"{GPU}/worker/jobs/{self.job_id}/complete", headers=WORKER_H,
                          json={"worker_id": self.WID, "chunks": 2, "mime": "video/mp4"}, timeout=10)
        assert r.status_code == 400

    def test_06_wrong_worker_complete_409(self):
        r = requests.post(f"{GPU}/worker/jobs/{self.job_id}/complete", headers=WORKER_H,
                          json={"worker_id": "intruder", "chunks": 1, "mime": "video/mp4"}, timeout=10)
        assert r.status_code == 409

    def test_07_complete_success(self):
        r = requests.post(f"{GPU}/worker/jobs/{self.job_id}/complete", headers=WORKER_H,
                          json={"worker_id": self.WID, "chunks": 1, "mime": "video/mp4"}, timeout=15)
        assert r.status_code == 200

    def test_08_client_sees_completed_with_url(self):
        r = requests.get(f"{GPU}/jobs/{self.job_id}", headers=CLIENT_H, timeout=10).json()
        assert r["status"] == "completed"
        assert r["video_url"].endswith(f"/api/gpu/files/{self.job_id}")

    def test_09_file_bytes_match(self):
        r = requests.get(f"{GPU}/files/{self.job_id}", headers=CLIENT_H, timeout=10)
        assert r.status_code == 200
        assert r.content == b"\x00" * 32

    # ---- retryable fail re-queues; non-retryable fails
    def test_10_fail_retryable_requeues(self):
        self._heartbeat()
        # submit another job
        r = requests.post(f"{GPU}/generate/video", headers=CLIENT_H,
                          json={"prompt": "retry", "model": "frasberg-dev-test", "duration": 1}, timeout=10).json()
        jid = r["task_id"]
        requests.post(f"{GPU}/worker/claim", headers=WORKER_H,
                      json={"worker_id": self.WID, "models": ["frasberg-dev-test"]}, timeout=10)
        r = requests.post(f"{GPU}/worker/jobs/{jid}/fail", headers=WORKER_H,
                          json={"worker_id": self.WID, "error": "transient", "retryable": True}, timeout=10)
        assert r.status_code == 200 and r.json()["requeued"] is True
        j = requests.get(f"{GPU}/jobs/{jid}", headers=CLIENT_H, timeout=10).json()
        assert j["status"] == "queued"

    def test_11_fail_non_retryable_marks_failed(self):
        self._heartbeat()
        requests.post(f"{GPU}/generate/video", headers=CLIENT_H,
                      json={"prompt": "boom", "model": "frasberg-dev-test", "duration": 1}, timeout=10)
        claimed = requests.post(f"{GPU}/worker/claim", headers=WORKER_H,
                                json={"worker_id": self.WID, "models": ["frasberg-dev-test"]}, timeout=10).json()["job"]
        assert claimed is not None
        jid = claimed["id"]
        r = requests.post(f"{GPU}/worker/jobs/{jid}/fail", headers=WORKER_H,
                          json={"worker_id": self.WID, "error": "fatal", "retryable": False}, timeout=10)
        assert r.status_code == 200 and r.json()["requeued"] is False
        j = requests.get(f"{GPU}/jobs/{jid}", headers=CLIENT_H, timeout=10).json()
        assert j["status"] == "failed"

    def test_99_cleanup(self):
        from pymongo import MongoClient
        c = MongoClient(ENV["MONGO_URL"])
        c[ENV["DB_NAME"]].gpu_workers.delete_many({"worker_id": self.WID})
