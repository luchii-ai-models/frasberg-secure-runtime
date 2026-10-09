"""Pre-download Frasberg engine weights into HF_HOME so the first job has no download wait.

Usage: python prefetch.py frasberg-motion-fast frasberg-image
"""
import sys

from huggingface_hub import snapshot_download

from engines import REPOS

for model in sys.argv[1:] or list(REPOS):
    for repo in REPOS.get(model, ()):
        print(f"[{model}] downloading {repo} ...", flush=True)
        snapshot_download(repo)
print("done")
