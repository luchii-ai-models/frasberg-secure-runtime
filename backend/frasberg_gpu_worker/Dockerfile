# Frasberg GPU Worker - NVIDIA CUDA 12.4 image
FROM pytorch/pytorch:2.5.1-cuda12.4-cudnn9-runtime
ENV PYTHONUNBUFFERED=1 HF_HOME=/models HF_HUB_ENABLE_HF_TRANSFER=1
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /worker
COPY requirements-gpu.txt .
RUN pip install --no-cache-dir -r requirements-gpu.txt
COPY engines.py worker.py prefetch.py ./
VOLUME ["/models"]
CMD ["python", "worker.py"]
