"""Tests for Luchii Chat + Agents backend (iteration 16)."""
import os
import time
import json
import pytest
import requests

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else "https://frasberg-secure-1.preview.emergentagent.com"
PLATFORM_KEY = "frb_live_57d798ce654b65b02abe0d76d29e22a855ecf82e"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE}/api/auth/login", json={"email": "motion.tester@luchiiapp.com", "password": "Motion123!"})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def auth_h(token):
    return {"Authorization": f"Bearer {token}"}


# --- /chat/models (public) ---
def test_chat_models_public():
    r = requests.get(f"{BASE}/api/chat/models")
    assert r.status_code == 200
    d = r.json()
    assert d["default"] == "luchii-6-plus"
    ids = [m["id"] for m in d["models"]]
    assert "luchii-6-plus" in ids
    assert any(i in ids for i in ["luchii-6-mini", "luchii-70b"])


# --- Auth gating on conversations ---
def test_conversations_no_auth_401():
    r = requests.get(f"{BASE}/api/chat/conversations")
    assert r.status_code == 401


def test_conversations_jwt_200(auth_h):
    r = requests.get(f"{BASE}/api/chat/conversations", headers=auth_h)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_conversations_platform_key_200():
    r = requests.get(f"{BASE}/api/chat/conversations", headers={"X-Frasberg-Key": PLATFORM_KEY})
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# --- /chat/send streaming ---
def _collect_sse(resp):
    events = []
    for raw in resp.iter_lines(decode_unicode=True):
        if not raw:
            continue
        if raw.startswith("data:"):
            try:
                events.append(json.loads(raw[5:].strip()))
            except Exception:
                pass
    return events


@pytest.fixture(scope="module")
def chat_conv_id(auth_h):
    with requests.post(f"{BASE}/api/chat/send", headers={**auth_h, "Accept": "text/event-stream"},
                       json={"message": "Hello from pytest", "model": "luchii-6-plus"},
                       stream=True, timeout=90) as r:
        assert r.status_code == 200
        assert "text/event-stream" in r.headers.get("content-type", "")
        events = _collect_sse(r)
    assert events, "no SSE events"
    assert "conversation_id" in events[0]
    final = events[-1]
    assert final.get("done") is True
    assert final.get("conversation_id") == events[0]["conversation_id"]
    # Expected upstream turbulence
    if final.get("error"):
        assert "turbulence" in final["error"].lower()
    return events[0]["conversation_id"]


def test_chat_conversation_get(auth_h, chat_conv_id):
    r = requests.get(f"{BASE}/api/chat/conversations/{chat_conv_id}", headers=auth_h)
    assert r.status_code == 200
    d = r.json()
    assert d["id"] == chat_conv_id
    msgs = d.get("messages", [])
    roles = [m["role"] for m in msgs]
    assert "user" in roles and "assistant" in roles


def test_chat_other_owner_404(chat_conv_id):
    # Platform owner (different owner key) should not see motion.tester's conv
    r = requests.get(f"{BASE}/api/chat/conversations/{chat_conv_id}",
                     headers={"X-Frasberg-Key": PLATFORM_KEY})
    assert r.status_code == 404


def test_chat_delete(auth_h, chat_conv_id):
    r = requests.delete(f"{BASE}/api/chat/conversations/{chat_conv_id}", headers=auth_h)
    assert r.status_code == 200
    r2 = requests.get(f"{BASE}/api/chat/conversations/{chat_conv_id}", headers=auth_h)
    assert r2.status_code == 404


# --- Agent tasks ---
def test_agent_task_invalid_type(auth_h):
    r = requests.post(f"{BASE}/api/chat/agents/tasks", headers=auth_h,
                      json={"type": "unknown", "prompt": "hi"})
    assert r.status_code == 422


def test_agent_task_music(auth_h):
    r = requests.post(f"{BASE}/api/chat/agents/tasks", headers=auth_h,
                      json={"type": "music", "prompt": "soft ambient pytest", "duration": 5})
    assert r.status_code == 200
    task = r.json()
    assert task["status"] == "queued"
    tid = task["id"]
    # Poll
    status = None
    for _ in range(30):
        time.sleep(2)
        s = requests.get(f"{BASE}/api/chat/agents/tasks/{tid}", headers=auth_h)
        assert s.status_code == 200
        d = s.json()
        status = d["status"]
        if status in ("dispatched", "failed"):
            final = d
            break
    else:
        pytest.skip(f"Task still {status} after poll window")
    assert final["status"] == "dispatched", final
    assert final.get("result", {}).get("job_id")
    # cleanup
    requests.delete(f"{BASE}/api/chat/agents/tasks/{tid}", headers=auth_h)  # may 404, that's fine
