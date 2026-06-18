import os, json, torch
from datasets import Dataset
from transformers import AutoModelForCausalLM, AutoTokenizer, TrainingArguments, Trainer, DataCollatorForLanguageModeling
from peft import LoraConfig, get_peft_model, TaskType

DATA_FILE = os.getenv("DATA_FILE", "../training-data.jsonl")
MODEL_NAME = os.getenv("BASE_MODEL", "Qwen/Qwen2.5-3B-Instruct")
OUTPUT_DIR = os.getenv("OUTPUT_DIR", "./lora-adapter")
LORA_R = int(os.getenv("LORA_R", "16"))
EPOCHS = int(os.getenv("EPOCHS", "3"))
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "1"))
LR = float(os.getenv("LEARNING_RATE", "2e-4"))
MAX_SEQ = int(os.getenv("MAX_SEQ_LENGTH", "256"))

SYSTEM_PROMPT = "You are a music genre classifier. Given a track name and artist, respond with the correct genre ID."

def load_data():
    print(f"[Data] Loading from {DATA_FILE}")
    rows = []
    with open(DATA_FILE, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    print(f"[Data] Loaded {len(rows)} tracks")
    return rows

def format_chat(name, artist, genre):
    return {
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f'Track: "{name}" by {artist}\nGenre:'},
            {"role": "assistant", "content": genre},
        ]
    }

def train():
    print(f"[Train] Model: {MODEL_NAME}")
    print(f"[Train] Output: {OUTPUT_DIR}")
    print(f"[Train] ROCm: {torch.version.hip if hasattr(torch.version, 'hip') else 'no'}")

    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME, trust_remote_code=True)
    tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "right"

    model = AutoModelForCausalLM.from_pretrained(
        MODEL_NAME,
        dtype=torch.bfloat16,
        device_map="auto",
        trust_remote_code=True,
        attn_implementation="sdpa",
    )
    model.config.use_cache = False
    model.gradient_checkpointing_enable()
    model.enable_input_require_grads()

    peft_config = LoraConfig(
        r=LORA_R,
        lora_alpha=LORA_R * 2,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        lora_dropout=0,
        bias="none",
        task_type=TaskType.CAUSAL_LM,
    )
    model = get_peft_model(model, peft_config)
    model.print_trainable_parameters()

    rows = load_data()
    chats = [format_chat(r["name"], r["artist"], r["genre"]) for r in rows]

    texts = []
    for c in chats:
        text = tokenizer.apply_chat_template(c["messages"], tokenize=False)
        texts.append(text)

    dataset = Dataset.from_list([{"text": t} for t in texts])
    dataset = dataset.train_test_split(test_size=0.1, seed=42)
    print(f"[Train] Train: {len(dataset['train'])} | Eval: {len(dataset['test'])}")

    def tokenize(batch):
        return tokenizer(batch["text"], truncation=True, max_length=MAX_SEQ, padding=False)

    dataset = dataset.map(tokenize, batched=True, remove_columns=["text"])

    collator = DataCollatorForLanguageModeling(tokenizer, mlm=False)

    trainer = Trainer(
        model=model,
        args=TrainingArguments(
            output_dir=OUTPUT_DIR,
            num_train_epochs=EPOCHS,
            per_device_train_batch_size=BATCH_SIZE,
            gradient_accumulation_steps=8,
            warmup_steps=10,
            learning_rate=LR,
            bf16=torch.cuda.is_available(),
            logging_steps=5,
            eval_strategy="epoch",
            save_strategy="epoch",
            save_total_limit=2,
            load_best_model_at_end=True,
            report_to="none",
            dataloader_num_workers=0,
        ),
        data_collator=collator,
        train_dataset=dataset["train"],
        eval_dataset=dataset["test"],
        processing_class=tokenizer,
    )

    print("[Train] Starting...")
    trainer.train()

    print("[Train] Saving adapter...")
    model.save_pretrained(OUTPUT_DIR)
    tokenizer.save_pretrained(OUTPUT_DIR)

    merged = model.merge_and_unload()
    merged.save_pretrained(f"{OUTPUT_DIR}/merged")
    tokenizer.save_pretrained(f"{OUTPUT_DIR}/merged")

    with open(f"{OUTPUT_DIR}/Modelfile", "w") as f:
        f.write(f"FROM {OUTPUT_DIR}/merged\n")

    print("[Train] Done!")
    print(f"ollama create blindtest-classifier -f {OUTPUT_DIR}/Modelfile")

if __name__ == "__main__":
    train()
