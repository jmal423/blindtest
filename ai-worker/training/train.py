import os, json
import torch
import psycopg2
from datasets import Dataset, DatasetDict
from transformers import (
    AutoModelForCausalLM, AutoTokenizer, TrainingArguments, Trainer,
    DataCollatorForLanguageModeling
)
from peft import LoraConfig, get_peft_model, TaskType

DB_URL = os.getenv("DATABASE_URL", "postgresql://jalfaiat:Eelflpbqjv2003!@192.168.1.49:5432/blindtest")
MODEL_NAME = os.getenv("BASE_MODEL", "Qwen/Qwen2.5-3B-Instruct")
OUTPUT_DIR = os.getenv("OUTPUT_DIR", "./lora-adapter")
LORA_R = int(os.getenv("LORA_R", "16"))
EPOCHS = int(os.getenv("EPOCHS", "3"))
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "1"))
LR = float(os.getenv("LEARNING_RATE", "2e-4"))
MAX_SEQ = int(os.getenv("MAX_SEQ_LENGTH", "256"))

PROMPT = """Track: "{title}" by {artist}
Genre:"""

def load_data():
    print("[Data] Loading curated songs...")
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    cur.execute("SELECT name, artist, genre FROM curated_songs WHERE verified = TRUE AND genre IS NOT NULL")
    rows = cur.fetchall()
    cur.close()
    conn.close()
    print(f"[Data] Loaded {len(rows)} tracks")
    return [r[2] for r in rows], rows

def train():
    print(f"[Train] Model: {MODEL_NAME}")

    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME, trust_remote_code=True)
    tokenizer.pad_token = tokenizer.eos_token

    model = AutoModelForCausalLM.from_pretrained(
        MODEL_NAME,
        torch_dtype="auto",
        device_map="auto",
        trust_remote_code=True,
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

    genres, rows = load_data()
    texts = [PROMPT.format(title=r[0], artist=r[1]) + f" {r[2]}" for r in rows]
    dataset = Dataset.from_list([{"text": t} for t in texts])

    def tokenize(batch):
        return tokenizer(batch["text"], truncation=True, max_length=MAX_SEQ)

    dataset = dataset.map(tokenize, batched=True, remove_columns=["text"])
    dataset = dataset.train_test_split(test_size=0.1, seed=42)

    print(f"[Train] Train: {len(dataset['train'])} | Eval: {len(dataset['test'])}")

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
            bf16=True,
            logging_steps=5,
            eval_strategy="epoch",
            save_strategy="epoch",
            save_total_limit=2,
            load_best_model_at_end=True,
            report_to="none",
        ),
        data_collator=collator,
        train_dataset=dataset["train"],
        eval_dataset=dataset["test"],
        processing_class=tokenizer,
    )

    print("[Train] Starting...")
    trainer.train()

    print(f"[Train] Saving adapter...")
    model.save_pretrained(OUTPUT_DIR)
    tokenizer.save_pretrained(OUTPUT_DIR)

    merged = model.merge_and_unload()
    merged.save_pretrained(f"{OUTPUT_DIR}/merged")
    tokenizer.save_pretrained(f"{OUTPUT_DIR}/merged")

    with open(f"{OUTPUT_DIR}/Modelfile", "w") as f:
        f.write(f"FROM {OUTPUT_DIR}/merged\n")

    print(f"[Train] Done!")
    print(f"ollama create blindtest-classifier -f {OUTPUT_DIR}/Modelfile")

if __name__ == "__main__":
    train()
