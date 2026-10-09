# Frasberg GPU Worker

This is Frasberg's own serverless GPU runtime. GPU machines run this worker. It pulls render jobs from the
**Frasberg Serverless GPU Gateway** (built into the Luchii backend at `/api/gpu`) over outbound HTTPS, so the
machine needs no inbound ports and no database access. A node can be added or removed at any time, and the
queue keeps going.

## Engines
| Engine id | Name | Modes | GPU |
|---|---|---|---|
| `frasberg-motion-fast` | Frasberg Motion Fast | text-to-video, image-to-video | 24GB+ (L4/A10/4090), best on 48-80GB |
| `frasberg-motion-pro` | Frasberg Motion Pro | text-to-video, image-to-video, 720p/24fps | 24GB+ |
| `frasberg-motion-ultra` | Frasberg Motion Ultra | text-to-video, image-to-video | 80GB (A100/H100) |
| `frasberg-image` | Frasberg Image | text-to-image | 16GB+ |

## Run on a GPU machine
```bash
docker build -t frasberg-gpu-worker .
docker run --gpus all -d --restart unless-stopped \
  -v frasberg-models:/models \
  -e FRASBERG_GATEWAY_URL=https://YOUR-LUCHII-DOMAIN/api/gpu \
  -e FRASBERG_WORKER_SECRET=<same value as backend FRASBERG_WORKER_SECRET> \
  -e FRASBERG_WORKER_MODELS=frasberg-motion-fast,frasberg-motion-pro,frasberg-image \
  frasberg-gpu-worker
# optional: warm the model cache first
docker run --rm -v frasberg-models:/models frasberg-gpu-worker python prefetch.py frasberg-motion-fast
```
If `FRASBERG_WORKER_MODELS` is not set, the worker picks every engine that fits the GPU's VRAM.

## Scaling and reliability
- **Scale out:** run more workers. They share one queue, and each claim is atomic.
- **Warm routing:** each worker claims jobs for the model it already has loaded first, which avoids cold starts.
- **Scale to zero:** after `FRASBERG_IDLE_UNLOAD_S` seconds idle (default 600), the worker frees the model from VRAM.
- **Self-healing:** if a worker dies mid-job, the job's lease expires (180s) and it is re-queued, up to 3 attempts.
  Out-of-memory errors are re-queued automatically.
- **Chunked upload:** results go up in 3MB chunks, so large videos pass any proxy limit.

## Calling Frasberg engines directly (any `frb_live_*` key in FRASBERG_API_KEYS)
```bash
curl -X POST https://YOUR-LUCHII-DOMAIN/api/gpu/generate/video \
  -H "Authorization: Bearer frb_live_..." -H "Content-Type: application/json" \
  -d '{"prompt":"a red fox running through snow","model":"frasberg-motion-pro","duration":5,"aspect_ratio":"9:16"}'
curl https://YOUR-LUCHII-DOMAIN/api/gpu/jobs/<task_id> -H "Authorization: Bearer frb_live_..."
```
To animate a photo (image-to-video), add `"image_base64": "<base64 png/jpg>"` to the request.
