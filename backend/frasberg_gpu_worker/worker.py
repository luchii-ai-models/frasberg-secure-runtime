"""Frasberg GPU Worker - runs on any NVIDIA GPU machine and serves Frasberg engines.

It pulls jobs from the Frasberg Serverless GPU Gateway over HTTPS (no inbound ports, no DB access),
renders them, and uploads the result in chunks.  Models stay warm while traffic flows and are
unloaded after FRASBERG_IDLE_UNLOAD_S seconds of idleness (scale-to-zero VRAM).

Env:
  FRASBERG_GATEWAY_URL     e.g. https://luchii.example.com/api/gpu
  FRASBERG_WORKER_SECRET   shared secret (same value as the gateway's FRASBERG_WORKER_SECRET)
  FRASBERG_WORKER_MODELS   comma list, e.g. frasberg-motion-fast,frasberg-image   (default: auto by VRAM)
  FRASBERG_WORKER_ID       optional stable id (default: hostname-random)
  FRASBERG_IDLE_UNLOAD_S   default 600
  HF_HOME                  model cache dir (mount a persistent volume here)
"""
import base64
import io
import logging
import os
import socket
import threading
import time
import traceback
import uuid

import requests

import engines

log = logging.getLogger("frasberg.worker")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

VERSION = "1.0.0"
GATEWAY = os.environ["FRASBERG_GATEWAY_URL"].rstrip("/")
SECRET = os.environ["FRASBERG_WORKER_SECRET"]
WORKER_ID = os.environ.get("FRASBERG_WORKER_ID") or f"{socket.gethostname()}-{uuid.uuid4().hex[:6]}"
IDLE_UNLOAD = int(os.environ.get("FRASBERG_IDLE_UNLOAD_S", "600"))
CHUNK = 3 * 1024 * 1024
H = {"X-Frasberg-Worker-Secret": SECRET, "X-Frasberg-Worker-Id": WORKER_ID}

state = {"busy": False, "last_job": time.time()}


def models_for_this_gpu() -> list:
    env = os.environ.get("FRASBERG_WORKER_MODELS")
    if env:
        return [m.strip() for m in env.split(",") if m.strip()]
    vram = engines.gpu_info()[1] or 0
    return [m for m, need in engines.MIN_VRAM.items() if m != "frasberg-dev-test" and vram >= need]


MODELS = models_for_this_gpu()


def post(path, **kw):
    r = requests.post(f"{GATEWAY}{path}", headers=H, timeout=60, **kw)
    r.raise_for_status()
    return r.json()


def heartbeat_loop():
    gpu, vram = engines.gpu_info()
    while True:
        try:
            post("/worker/heartbeat", json={"worker_id": WORKER_ID, "models": MODELS, "gpu": gpu, "vram_gb": vram,
                                            "loaded_model": engines.loaded_model(), "busy": state["busy"],
                                            "version": VERSION})
        except Exception as e:  # noqa: BLE001
            log.warning("heartbeat failed: %s", e)
        if not state["busy"] and engines.loaded_model() and time.time() - state["last_job"] > IDLE_UNLOAD:
            log.info("idle %ss - unloading %s (scale to zero)", IDLE_UNLOAD, engines.loaded_model())
            engines.unload()
        time.sleep(15)


def upload(job_id: str, data: bytes) -> int:
    n = 0
    for i in range(0, len(data), CHUNK):
        for attempt in range(4):
            try:
                r = requests.put(f"{GATEWAY}/worker/jobs/{job_id}/chunk/{n}", data=data[i:i + CHUNK],
                                 headers={**H, "Content-Type": "application/octet-stream"}, timeout=120)
                r.raise_for_status()
                break
            except Exception:  # noqa: BLE001
                if attempt == 3:
                    raise
                time.sleep(2 ** attempt)
        n += 1
    return n


def run(job: dict):
    jid = job["id"]
    t0 = time.time()

    def progress(p: float):
        try:
            post(f"/worker/jobs/{jid}/progress", json={"worker_id": WORKER_ID, "progress": p})
        except Exception:  # noqa: BLE001
            pass

    image = None
    if job.get("image_base64"):
        from PIL import Image
        image = Image.open(io.BytesIO(base64.b64decode(job["image_base64"]))).convert("RGB")
    data, mime = engines.render(job["model"], prompt=job["prompt"], negative_prompt=job.get("negative_prompt"),
                                duration=job.get("duration") or 5, aspect_ratio=job.get("aspect_ratio") or "16:9",
                                seed=job.get("seed"), image=image, progress=progress)
    chunks = upload(jid, data)
    post(f"/worker/jobs/{jid}/complete", json={"worker_id": WORKER_ID, "chunks": chunks, "mime": mime,
                                                "render_seconds": round(time.time() - t0, 1)})
    log.info("completed %s (%s, %d bytes, %.1fs)", jid, job["model"], len(data), time.time() - t0)


def main():
    log.info("Frasberg GPU Worker %s id=%s gpu=%s models=%s gateway=%s", VERSION, WORKER_ID, engines.gpu_info(),
             MODELS, GATEWAY)
    if not MODELS:
        raise SystemExit("No Frasberg engines fit this GPU - set FRASBERG_WORKER_MODELS explicitly")
    threading.Thread(target=heartbeat_loop, daemon=True).start()
    while True:
        try:
            job = post("/worker/claim", json={"worker_id": WORKER_ID, "models": MODELS,
                                              "loaded_model": engines.loaded_model()}).get("job")
        except Exception as e:  # noqa: BLE001
            log.warning("claim failed: %s", e)
            time.sleep(5)
            continue
        if not job:
            time.sleep(2)
            continue
        state["busy"] = True
        try:
            run(job)
        except Exception as e:  # noqa: BLE001
            log.error("job %s failed: %s", job["id"], traceback.format_exc())
            oom = "out of memory" in str(e).lower()
            try:
                post(f"/worker/jobs/{job['id']}/fail", json={"worker_id": WORKER_ID, "retryable": oom,
                                                            "error": f"{e.__class__.__name__}: {e}"[:400]})
            except Exception:  # noqa: BLE001
                pass
            if oom:
                engines.unload()
        finally:
            state["busy"] = False
            state["last_job"] = time.time()


if __name__ == "__main__":
    main()
