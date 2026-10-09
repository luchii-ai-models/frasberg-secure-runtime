# Luchii AI Clone — PRD

## Original problem
Import and clone an exact copy of luchii-ai.com (tools, files, database, features, models, stack) and wire it with the user's own Frasberg keys. No Emergent universal key. Production uses the live MongoDB `luchii-tools`.

## Architecture
- Frontend: the original React source, recovered from the live site's public source map (`main.65f24d02.js.map`). Same pages, styles, starfield, mock content.
- Backend: FastAPI rewritten to match the live API contract. Every AI call goes through Frasberg (`FRASBERG_BASE_URL=https://frasberg.com/api`). It rotates through 8 `frb_live_*` keys, retrying on permission and server errors.
- DB: MongoDB collections `users`, `generations`, `jobs`, `login_attempts`. Preview uses local Mongo because Atlas blocks this pod's IP. Production uses MONGO_URL/DB_NAME from the deployment secrets.

## Implemented (2026-06)
- Pages: Home, /create (text-to-image, image-to-image, upscale, share, download), /gallery, /s/:id, /models, /tts, /developers, /legal/:doc. New: /video (Video Creator) and /audio (Audio Studio).
- JWT auth (register/login/me), lockout after 5 bad attempts per email.
- Frasberg wiring: /generate/image (generate/edit/upscale), /voice/speak (TTS), /generate/video and /generate/music, polled via /jobs/{id}, with a music WAV proxy.

## Upstream status (Frasberg, at build time)
- Image: HTTP 502 upstream. TTS: 503 "voice engine warming up". Only key #5 has music permission, and none of the keys have text_to_speech permission.
- Video jobs complete, but they return sample MDN clips.

## Backlog
- P0: Get Frasberg image and voice endpoints healthy. Grant text_to_speech permission to the keys.
- P1: Speech to Speech, 3D Studio, Spaces Builder (still "Soon").
- P2: Frasberg chat (luchii-6-plus) assistant inside the app.

## Update (2026-10)
- In-house Luchii engines are used when a Frasberg-keyed call fails: Piper voices (TTS/STS), faster-whisper base (STT), SD-Turbo on CPU (generate/edit/upscale). Models are stored in LUCHII_MODELS_DIR and preloaded at startup.
- Voice Cloning page (/voice-clone): samples are stored in a GridFS voice_samples bucket. Speaking in the cloned voice is Frasberg-only.
- Per-feature key routing via FRASBERG_KEY_ROUTES.
- The /status page and /api/engines/status are admin-only (ADMIN_EMAILS) and the Status link is no longer in the public nav.
- The homepage showcase only shows generations with featured=true and otherwise falls back to the curated graphics.

## Update (2026-10, import)
- Restored from GitHub frasberg-code/luchii-tools into a new pod. Backend .env restored, frontend uses this pod URL. Deps installed (emergentintegrations/litellm skipped, not used). Smoke tests passed (iteration_5).
- 2026-10: Image queue (429 + Retry-After when the local image engine is busy; /create shows a queue notice and auto-retries). /login and /signup routes open the auth modal (?next= supported). STS studio upgraded: editable transcript, re-speak in any voice, takes history with download. Tests: iteration_6 all pass.
- 2026-10: Rebrand to "Luchii" with the new logo/favicon and "Powered by Frasberg" copy. 3D Studio (/3d) uses Shap-E on CPU (DPM++ 10 steps, ~3 min), with jobs queued in db.models3d and GLBs stored in GridFS. Model files are in LUCHII_SCRATCH_MODELS_DIR and re-download after a restart. Voice clone uses a vendored OpenVoice V2 converter (backend/vendor/openvoice) as a fallback in /voice/clone/speak and in /sts voice=clone. Saved voice takes are in db.voice_takes plus GridFS, shown in the /gallery tabs. Tests: iteration_7 passes.

## Update (2026-06, fork — stability fix + feature validation)
- **FIXED critical pod-restart loop**: boot-time `warm_up()` preloaded SD-Turbo + OpenVoice into RAM AND `snapshot_download`-ed ~6GB of Shap-E/music weights to `/tmp` (wiped every restart). This flooded the 8GB cgroup → kubelet evicted the whole pod mid-download → infinite loop every ~3-5 min, killing every long-running job with "Interrupted by a server restart". 
  - Changes: `LUCHII_SCRATCH_MODELS_DIR` → `/var/luchii-models/scratch` (persistent, backend/.env). `warm_up()` now only pre-caches the small Piper voice; all heavy engines (SD, Shap-E, MusicGen, OpenVoice) load lazily on first request. Removed the auto `prefetch_scratch_models` call from startup (kept the fn for optional use). Backend now stable for 6+ min idle, pid unchanged.
- **Validated REAL generation end-to-end** (all produce real files, pod stable, peak mem ~5GB of 8GB):
  - Image: SD-Turbo local (proven earlier).
  - Music: MusicGen → 321KB WAV 16-bit mono 32kHz.
  - Video: SD-Turbo frames → 252KB MP4 (glTF... no, ISO MP4 v1).
  - 3D: Shap-E → 4.3MB GLB (glTF binary v2). Text-to-3D has no thumbnail by design (frontend renders GLB in a viewer).
  - Speech-to-Speech (/sts): faster-whisper transcribe + Piper re-voice → 117KB WAV, accurate transcript.
- 3D Studio (/3d) and Speech-to-Speech (/sts) pages confirmed fully built and loading; both usable without login.

## Update (2026-06, fork — generation speed + memory optimization)
Hardware reality of this pod: **2 CPU cores, no AVX2/bf16 hardware, ~6GB effective memory** (the 8GB cgroup is never the killer — oom_kill stays 0; the pod is evicted at the node/pod level around 6GB). So bf16/fp16 are useless (emulated → slower) and only ~1 big model fits at a time.
- **Images 2.4x faster (38s → 10–16s):** swapped SD-Turbo's heavy VAE for the TAESD tiny VAE (`madebyollin/taesd`) + `channels_last`. Quality verified unchanged (photorealistic, no artifacts). Same SD pipeline powers **video**, so video keyframes are faster too.
- **One-heavy-model-resident policy (`_claim` in local_engines.py):** SD (image/video), Shap-E (3D) and MusicGen (music) are mutually exclusive — before a different big engine loads, the others are freed + `gc.collect()` + `libc malloc_trim(0)` to return RSS to the OS. This prevents the two-models-resident spike that was evicting the pod. OpenVoice/Whisper/Piper are small and stay resident.
- **3D weight caching (the explicit ask):** Shap-E weights persist on disk (`/var/luchii-models/scratch`, no re-download) and the loaded pipeline stays resident across requests, so **repeat 3D requests skip the load and complete reliably** (verified: warm repeat 3D ran with a stable pid). Added `low_cpu_mem_usage=True` to the Shap-E load.
- **Self-healing first load:** the first Shap-E/MusicGen load has a transient spike that can trip a pod restart on this tight budget. `_resume_interrupted_jobs()` now re-queues interrupted media/3D jobs (bounded to MAX_JOB_ATTEMPTS=3, text-source only for 3D) instead of hard-failing — on retry the model file is warm in cache, the spike is smaller, and the job completes. Verified: a cold 3D job self-healed across a restart and finished (3MB GLB).
- **Validated end-to-end after changes:** image 10–16s, video MP4, 3D 3MB GLB, music WAV, S2S WAV — all real files, services stable.
- Note for future: 3D's first cold load remains the only fragile step on this 2-core/~6GB pod. A larger pod (or a dedicated 3D worker) would make it instant and bulletproof.
