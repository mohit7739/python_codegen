# 🦙 Merge LoRA Adapter + Push Full Model to HuggingFace
# Run this notebook in Google Colab (GPU recommended but not required)

# ── CELL 1: Install dependencies ──────────────────────────────────────────────
!pip install -q transformers peft torch accelerate huggingface_hub

# ── CELL 2: Login to HuggingFace ──────────────────────────────────────────────
from huggingface_hub import login
import os

HF_TOKEN = os.environ.get("HF_TOKEN", "")  # set via: export HF_TOKEN=your_token
login(token=HF_TOKEN)

# ── CELL 3: Load base model + LoRA adapter and merge ──────────────────────────
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel

BASE_MODEL   = "TinyLlama/TinyLlama-1.1B-Chat-v1.0"   # original base model
ADAPTER_REPO = "mohit7739/tinyllama-python-coder-lora"  # your adapter on HF
OUTPUT_REPO  = "mohit7739/tinyllama-python-coder"       # merged model destination

print("Loading base model...")
base_model = AutoModelForCausalLM.from_pretrained(
    BASE_MODEL,
    torch_dtype=torch.float16,
    device_map="auto",
)

print("Loading tokenizer...")
tokenizer = AutoTokenizer.from_pretrained(ADAPTER_REPO)

print("Loading LoRA adapter...")
model = PeftModel.from_pretrained(base_model, ADAPTER_REPO)

print("Merging adapter into base model weights...")
model = model.merge_and_unload()   # <-- fuses LoRA into the base weights

print("✅ Merge complete!")

# ── CELL 4: Quick test before uploading ───────────────────────────────────────
prompt = "### Instruction:\nWrite a Python function to reverse a string.\n\n### Response:\n"
inputs = tokenizer(prompt, return_tensors="pt").to(model.device)

with torch.no_grad():
    outputs = model.generate(**inputs, max_new_tokens=100, temperature=0.7, do_sample=True)

response = tokenizer.decode(outputs[0], skip_special_tokens=True)
print("\n─── TEST OUTPUT ───")
print(response.split("### Response:\n")[-1])

# ── CELL 5: Push merged model to HuggingFace Hub ──────────────────────────────
print(f"\nPushing merged model to: {OUTPUT_REPO}")
model.push_to_hub(OUTPUT_REPO, use_auth_token=HF_TOKEN)
tokenizer.push_to_hub(OUTPUT_REPO, use_auth_token=HF_TOKEN)
print("✅ Done! Your merged model is now live at:")
print(f"   https://huggingface.co/{OUTPUT_REPO}")
