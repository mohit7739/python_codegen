"""
Run this once to automatically create the HuggingFace Space and push the files.
Usage: python create_space.py
"""
from huggingface_hub import HfApi, create_repo, upload_file
import os

HF_TOKEN   = os.environ.get("HF_TOKEN", "")  # set via: export HF_TOKEN=your_token
SPACE_REPO = "mohit7739/tinyllama-python-coder"

api = HfApi(token=HF_TOKEN)

# 1. Create the Space repo (SDK=gradio, CPU-free hardware)
print(f"Creating Space: {SPACE_REPO} ...")
create_repo(
    repo_id=SPACE_REPO,
    repo_type="space",
    space_sdk="gradio",
    exist_ok=True,
    token=HF_TOKEN,
)
print("Space created!")

# 2. Upload app.py
script_dir = os.path.dirname(os.path.abspath(__file__))
upload_file(
    path_or_fileobj=os.path.join(script_dir, "hf_space", "app.py"),
    path_in_repo="app.py",
    repo_id=SPACE_REPO,
    repo_type="space",
    token=HF_TOKEN,
)
print("Uploaded app.py")

# 3. Upload requirements.txt
upload_file(
    path_or_fileobj=os.path.join(script_dir, "hf_space", "requirements.txt"),
    path_in_repo="requirements.txt",
    repo_id=SPACE_REPO,
    repo_type="space",
    token=HF_TOKEN,
)
print("Uploaded requirements.txt")

print("\n✅ Done! Your Space is now building at:")
print(f"   https://huggingface.co/spaces/{SPACE_REPO}")
print("\nWatch the build log there. Once it says 'Running', your app will work!")
