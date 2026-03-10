import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import gradio as gr

MODEL_ID = "mohit7739/tinyllama-python-coder"

# ── Load model once at startup ─────────────────────────────────────────────────
print(f"Loading {MODEL_ID} ...")
tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
model = AutoModelForCausalLM.from_pretrained(
    MODEL_ID,
    torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
    device_map="auto",
)
model.eval()
print("Model ready!")


def _run(instruction: str, max_new_tokens: int = 400, temperature: float = 0.7) -> str:
    prompt = f"### Instruction:\n{instruction}\n\n### Response:\n"
    inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
            temperature=temperature,
            do_sample=True,
            eos_token_id=tokenizer.eos_token_id,
            pad_token_id=tokenizer.eos_token_id,
        )
    new_tokens = outputs[0][inputs["input_ids"].shape[1]:]
    return tokenizer.decode(new_tokens, skip_special_tokens=True).strip()


# ── FastAPI app with a clean /generate endpoint ────────────────────────────────
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class GenerateRequest(BaseModel):
    instruction: str
    max_new_tokens: int = 400
    temperature: float = 0.7

@app.post("/generate")
def generate(req: GenerateRequest):
    result = _run(req.instruction, req.max_new_tokens, req.temperature)
    return {"generated_text": result}

@app.get("/health")
def health():
    return {"status": "ok"}


# ── Gradio UI (mounted at /) ───────────────────────────────────────────────────
demo = gr.Interface(
    fn=_run,
    inputs=[
        gr.Textbox(label="Instruction", placeholder="Write a Python function to..."),
        gr.Slider(50, 800, value=400, step=50, label="Max new tokens"),
        gr.Slider(0.1, 1.0, value=0.7, step=0.05, label="Temperature"),
    ],
    outputs=gr.Textbox(label="Response"),
    title="🦙 TinyLlama Python Coder",
    description="Fine-tuned TinyLlama 1.1B for Python code generation by Mohit Kumar.",
)

app = gr.mount_gradio_app(app, demo, path="/")
