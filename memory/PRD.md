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
- P2: (dropped by the user) in-app chat assistant.

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

## Update (2026-06, fork — Prompt Presets + video reality check)
- **Prompt Presets shipped (all 4 studios), tested 100% (iteration_8):** one-tap chips that fill a ready-to-go prompt (and matching style). Data in `/app/frontend/src/presets.js`, reusable `PresetRow` in `/app/frontend/src/components/PresetRow.jsx`. Image: Portrait/Landscape/Product/Anime/Logo/Sci-fi. Video: Cinematic/Nature/Anime/Product ad/Fantasy/Vlog. Music (user-requested genres): Reggae, Reggae Fusion, Reggae Dancehall, Amapiano, Jazz. 3D: Game asset/Character/Vehicle/Furniture/Food/Sci-fi prop.
- **CONFIRMED: Frasberg/Luchii video API is FAKE.** POST https://frasberg.com/api/generate/video returns a job that "completes" with `video_url = https://filesamples.com/samples/video/mp4/sample_640x360.mp4` — a public stock sample clip, unrelated to the prompt (gpu_class/region fields are cosmetic). So the Frasberg keys cannot produce real video. The current `/video` endpoint uses the **local SD-Turbo keyframe + Ken Burns slideshow** (local_engines.generate_video) — which is why users see drifting slideshows with warped faces. Real AI video is GPU-only and cannot run on this 2-core CPU pod.
- **BLOCKED — real AI video needs fal.ai (or similar) + the user's API key.** Plan once key provided: integrate fal.ai text-to-video + image-to-video (image-to-video = TikTok-style animate-a-photo), with a per-generation model/quality selector (fast LTX-Video ↔ high-quality Kling/Veo). Route `/video` to fal.ai, keep local slideshow only as a last-ditch fallback, and update the video studio copy (currently claims "Powered by Frasberg renders keyframes").

## Update (2026-10, re-import + Frasberg key audit)
- Re-imported luchii-ai-models/frasberg-secure-runtime (HEAD 8cae905). Recreated backend/.env + frontend/.env (they were missing), created /var/luchii-models/scratch. Services up.
- All 9 user keys wired (FRASBERG_API_KEYS) with per-feature routing (FRASBERG_KEY_ROUTES): image→be3354f2, video→a1872bf2|be3354f2, music→a0e8a8fb|722a8e9e, clone→eac278f3, audio→0257e1a1, stt→b439ef0d, tts→57d798ce. Key 9b4aa1f2 kept but returns 401 key_not_found.
- Key audit (live, 2026-10-09): /generate/image = 502 on every key; /voice/speak = 403/503; /generate/video "completes" with rotating stock clips (filesamples, test-videos.co.uk Big Buck Bunny, MDN flower.mp4), `model` field ignored; /generate/music returns a synthesized fixed chord drone ("mood":"major"), not prompt-specific music. Frasberg's own site bundle references no real video model.
- /video is now Frasberg-first: `frasberg_video()` submits to the Video Engine key, polls, accepts only non-sample renders, otherwise falls back to the local engine. Job status exposes `engine` (frasberg | luchii-local).
- Frasberg server is NOT in this repo — it must be fixed on the Frasberg side (real GPU models) for real renders.

## Update (2026-10, Frasberg Serverless GPU)
- `backend/frasberg_gpu.py` is the Frasberg Serverless GPU Gateway, mounted at `/api/gpu` and tested 21/21 in iteration_9.
  - Client API in the frasberg.com style: `/v1/engines`, `/generate/video`, `/generate/image`, `/jobs/{id}`, `/files/{id}`. Auth is the exact frb_live keys from FRASBERG_API_KEYS; a bad key returns FK-001.
  - Worker pull API at `/worker/*`, using the FRASBERG_WORKER_SECRET header. Includes heartbeat, an atomic claim that prefers the warm model, chunked upload, a 180s lease with re-queue (3 attempts max), and re-queue on OOM.
  - Mongo collections: gpu_jobs, gpu_workers, gpu_chunks. GridFS bucket: gpu_outputs.
- `/app/frasberg_gpu_worker/` is a standalone worker (Dockerfile, requirements-gpu.txt, prefetch.py, NOTICE.md). Its engines are frasberg-motion-fast (LTX-Video 0.9.7 distilled, two-stage), frasberg-motion-pro (Wan 2.2 TI2V-5B), frasberg-motion-ultra (HunyuanVideo T2V and I2V) and frasberg-image (FLUX.1-schnell). The hidden frasberg-dev-test engine is only for protocol testing. Unloads after an idle timeout (scale-to-zero).
  - NEVER pip install requirements-gpu.txt into the backend venv. It upgrades diffusers and transformers and breaks the local engines (backend pins diffusers 0.31.0 and transformers 4.46.3).
- Luchii `/api/video` accepts model, aspect_ratio and image_base64. Routing order: an online GPU worker for the chosen engine, then any online motion engine, then frasberg.com, then Frasberg Lite (local CPU).
  - frasberg.com clips are rejected if the URL is a known sample or the bytes repeat a render made for a different prompt (db.frasberg_video_hashes).
- `/api/generate` (text-to-image) tries the Frasberg Image GPU first when a worker is online.
- `/video` UI has an engine picker with live status, format chips, a start-image upload (image-to-video), and the engine label and progress percentage. The Models page lists Motion Fast, Pro and Ultra.
- BLOCKER for real renders: at least one NVIDIA GPU machine (24GB+, or 80GB for Ultra) must run the worker. This pod has no GPU.

## Update (2026-10, video presets + gallery)
- The /video page has "Trending" TikTok-style presets: Surprise me (a random idea from SURPRISE_VIDEO_IDEAS), POV, Glow-up transition, Satisfying loop, Pet reaction, Street dance, Food ASMR and Outfit check. Picking one sets the format to 9:16.
- Once a start image is attached, a "Photo motion" row replaces those presets: Zoom in, Orbit 360, Hair in wind, Come alive, Dolly out, 3D parallax, Slow-mo, Rain & neon. Data is in presets.js.
- New `GET /api/videos` (signed-in user's finished clips) and public `GET /api/videos/{id}`. Legacy engine labels are mapped to Frasberg names.
- The gallery has a Videos tab: each clip card has a player, a badge, replay, share, download and open.
- Public share page at `/v/:id`. Shared clips use the native share sheet when available, otherwise the link is copied. Studio results also get a Share button.
- Tests: iteration_10 passed 100% (backend tests in backend/tests/test_videos_api.py).

## Update (2026-10, zero-cost real video)
- Checked github.com/frasberg-code/frasberg-secure-runtime (now public). Its /api/video only forwards to frasberg.com, and cinematicRenderV2 is an ffmpeg placeholder. It contains no video model or GPU code.
- Emergent has no GPU hosting. The Sora 2 API was shut down on 2026-09-24. Veo needs a paid Google key, which the user declined (zero cost).
- New engine **frasberg-motion-free** (LTX-Video 2B, 480p, text-to-video and image-to-video) for free 16GB T4s (Kaggle/Colab). Its calls were checked against diffusers 0.39 with tiny random weights.
- Worker package moved to /app/backend/frasberg_gpu_worker. The gateway serves its files at /api/gpu/worker/files/{name} (worker secret required).
- Admin endpoints: /api/gpu-admin/overview and /api/gpu-admin/notebook. The notebook comes pre-filled with the gateway URL and secret, and the gateway must be this server's own host.
- /status now has a GPU panel: workers, job counts, a free-notebook download and Kaggle steps.
- Queued GPU jobs expire after 30 minutes (QUEUE_TTL).
- Honest UI: a "Preview mode" banner shows when no GPU is online, and Lite clips are labelled "Preview · animated stills" (studio, gallery, share page). The engine defaults to Motion Free and auto-selects an online engine.
- Tests: iteration_11 passed 37/37 backend plus all frontend checks.
- Preview-only admin test account: admin.tester@luchiiapp.com is in ADMIN_EMAILS in backend/.env.

## Update (2026-06, re-import)
- Re-imported luchii-ai-models/frasberg-secure-runtime. Recreated backend/.env with the 8 user frb_live keys + FRASBERG_KEY_ROUTES, installed deps + ffmpeg, re-created admin.tester / motion.tester accounts. Smoke tests passed (iteration_12).
- /status GPU panel polling now pauses when the tab is hidden.
- P2 in-app chat assistant was built, then REMOVED at the user's request (it is not wanted in the app). Do not re-add it.
- 2026-06: Rebranded the platform from "Luchii" to "Frasberg Creator" (nav, hero, footer, auth, legal, studios, share pages, title, toasts) with the FA Frasberg emblem as logo + favicon. "Luchii" now only names the Frasberg AI models and intelligence (Luchii Models, Luchii Prime, Vision, etc.). Internal storage keys (luchii_token) unchanged.
- 2026-06: Luchii logo restored for Luchii Models (Models page family header + each Luchii model card, API docs note). "Made with Luchii" restored (home featured, share page, 3D share). Footer copyright: "© 2003-2026, Frasberg, Inc. or its affiliates". Legal states Frasberg.com / Frasberg, Inc. own and operate Luchii AI Models and all Luchii products and systems. luchii-ai.com stays.
- 2026-06: Luchii badge (components/LuchiiBadge.jsx) on all creations: create result, gallery image + video cards, image share /s/:id, video share /v/:id, video & music studio results. New /about-luchii page (logo, 5 pillars, model family, CTAs), linked from footer "About Luchii". Tests: iteration_13 100%.
- 2026-06: "About Luchii" nav link with Luchii logo (desktop + mobile). Badges now name the model: Nova-Muse (default), Dreamline (anime/digital-art), Vision (3d), Painter-X (remix), Prime (upscale), Luchii Video, Luchii Audio (components/LuchiiBadge.jsx luchiiModelFor). Downloads carry the Luchii mark: images via canvas (lib/luchiiMark.js), videos via GET /api/media/{id}/download (ffmpeg overlay, cached in GridFS marked_file_id). /api/share/{id} returns kind. Tests: iteration_14 100%.
- 2026-06: Named Luchii video/music models: Luchii Cinematica (text-to-video), Luchii Animus (photo-to-video), Luchii Harmonia (music) — shown on all badges and as cards on /models. Gallery Images and Videos tabs have a Luchii model filter (chips, only shown when 2+ models present). Tests: iteration_15 100%.
- 2026-06: Nav/footer "About Luchii" renamed "Luchii Code" (still /about-luchii).
- 2026-06: Luchii Chat BACKEND ONLY (for other Frasberg platforms — no chat UI on this creator site, user explicit): GET /api/chat/models (proxy Frasberg /v1/models, chat-capable), GET/DELETE /api/chat/conversations[/id], POST /api/chat/send (SSE stream proxy to Frasberg /v1/chat, model switch, session continuity, db.chat_conversations), POST/GET /api/chat/agents/tasks (agents dispatch image/video/music creator jobs, db.agent_tasks). Auth: user JWT or X-Frasberg-Key (frb_live key). Upstream luchii chat currently replies "turbulence".
- 2026-06: Luchii model picker on /create (Nova-Muse / Dreamline / Vision for text, Painter-X for remix); model sent to /api/generate (prompt hint, stored on generation), shown on badges; /models "Try" preselects. Tests: iteration_16 100%.

## Update (2026-10, conflict branch merged)
- Re-imported luchii-ai-models/frasberg-secure-runtime. Branch `conflict_091026_2226` had unrelated history (squashed re-import of main@00fd644 + assistant). Grafted it onto main@00fd644 and 3-way merged: clean, no file conflicts. Result = main + all conflict-branch work (Agent bundle /api/chat/agents/bundle, Luchii Cinematica/Animus/Harmonia model selection, 429 retry, VideoModelPicker, ChatDocs, LuchiiAgent page, Luchii Code/Chat backend, badges/marks). Temp PR template removed.
- Recreated backend/.env (8 frb_live keys + FRASBERG_KEY_ROUTES) and frontend/.env, installed deps + ffmpeg, seeded test accounts.

## Update (2026-10, photoreal engine + async image jobs + real showcase)
- Frasberg has no image model: /v1/models + docs list only chat/embed/music/audio, and /api/generate/image returns a Cloudflare 502 on every key. So images come from the in-house Luchii engines (zero cost, no third-party keys).
- NEW photoreal engine for **Luchii Nova-Muse**: Realistic Vision V6 (fp16 single file) + sd-vae-ft-mse + LCM-LoRA, 4 steps, cfg 1.0, ~2 min on the 2-core CPU (local_engines.generate_photo). Dreamline/Vision stay on SD-Turbo (~15-20s).
- All image weights (RV6, LCM, VAE, SD-Turbo fp16 variant, TAESD) are in LUCHII_PHOTO_MODELS_DIR=/root/luchii-models/hf on the PERSISTENT volume. /var and /tmp are wiped on pod restart. HF_HUB_DISABLE_XET=1 is needed, because xet downloads hang or crash here.
- Async image jobs: POST /api/generate/jobs, /api/edit/jobs, /api/upscale/jobs -> {job_id}; GET /api/image-jobs/{id} -> {status queued|running|completed|failed, result{...image_base64}}. Jobs go stale after 20 min. /create uses them now (no more ingress 502 on long renders). The sync /api/generate etc. are kept for the API and agents.
- Homepage showcase: the 8 Unsplash/Pexels stock photos were replaced with images generated by this system from the same 8 prompts (frontend/public/showcase/*.jpg, mock.js).
- Known limits: Painter-X (SD-Turbo img2img) barely follows edit instructions. cfg 1.0 means the negative prompt is ignored.
