"""Pre-download Frasberg engine weights into HF_HOME so the first job has no download wait.

Only the files each diffusers pipeline needs are fetched (repos like Lightricks/LTX-Video also host very
large extra checkpoints that are skipped).

Usage: python prefetch.py frasberg-motion-free frasberg-image
"""
import sys

from diffusers import DiffusionPipeline

from engines import REPOS

for model in sys.argv[1:] or list(REPOS):
    for repo in REPOS.get(model, ()):
        print(f"[{model}] downloading {repo} ...", flush=True)
        DiffusionPipeline.download(repo)
print("done")
