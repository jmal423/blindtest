# LoRA fine-tuning script for BlindTest genre classifier
# Uses curated_songs data (1395 labeled tracks) to fine-tune Qwen2.5 7B
# 
# Usage:
#   set DATABASE_URL=postgresql://user:pass@host:5432/blindtest
#   set OLLAMA_URL=http://127.0.0.1:11434
#   python train.py

import os, json, sys
import torch
from datasets import Dataset, DatasetDict
from unsloth import FastLanguageModel, is_bfloat16_supported
from transformers import TrainingArguments
from trl import SFTTrainer

DB_URL = os.getenv("DATABASE_URL", "postgresql://jalfaiat:Eelflpbqjv2003!@192.168.1.49:5432/blindtest")
MODEL_NAME = os.getenv("BASE_MODEL", "unsloth/Qwen2.5-7B-bnb-4bit")
OUTPUT_DIR = os.getenv("OUTPUT_DIR", "./lora-adapter")
LORA_R = int(os.getenv("LORA_R", "16"))
EPOCHS = int(os.getenv("EPOCHS", "3"))
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "2"))
LR = float(os.getenv("LEARNING_RATE", "2e-4"))
MAX_SEQ = int(os.getenv("MAX_SEQ_LENGTH", "512"))

GENRES = [
    "PT_fado","PT_tradicional_folklore_pimba","PT_pop_tuga","PT_pop_rock_tuga",
    "PT_hip_hop_tuga","PT_classica_tuga","PT_kizomba_palop","PT_pop_urbano_nova_pop",
    "BR_samba_pagode","BR_bossa_nova","BR_funk_brasileiro","BR_pop_rock_brasileiro","BR_pop",
    "US_pop_us","US_hip_hop_trap_us","US_country_americana_us","US_rock_alternative_us",
    "UK_pop_uk","UK_uk_drill_grime","UK_britpop_rock_uk","UK_uk_garage_dnb",
    "FR_chanson_francaise","FR_pop_francaise","FR_rap_francais","FR_french_touch_electro",
    "ES_flamenco","ES_reggaeton_urbano","ES_musica_regional_latina",
    "GL_reggae","GL_kpop","GL_edm_dance","GL_afrobeats_african",
    "GL_metal","GL_soundtracks","GL_jazz_lounge","GL_other"
]

PROMPT = """Classify this music track into one genre.

Genres:
{genres}

Track: "{title}" by {artist}
Genre:"""

def load_data():
    import psycopg2
    print("[Data] Loading curated songs from database...")
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    cur.execute("SELECT name, artist, genre FROM curated_songs WHERE verified = TRUE AND genre IS NOT NULL")
    rows = cur.fetchall()
    cur.close()
    conn.close()
    print(f"[Data] Loaded {len(rows)} labeled tracks")
    return rows

def format_data(rows):
    genres_list = "\n".join(f"- {g}" for g in GENRES)
    examples = []
    for name, artist, genre in rows:
        prompt = PROMPT.format(genres=genres_list, title=name, artist=artist)
        examples.append({"text": prompt + f" {genre}"})
    return examples

def train():
    print(f"[Train] Model: {MODEL_NAME}")
    print(f"[Train] Output: {OUTPUT_DIR}")
    print(f"[Train] Epochs: {EPOCHS}, Batch: {BATCH_SIZE}, LR: {LR}")

    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=MODEL_NAME,
        max_seq_length=MAX_SEQ,
        dtype=None,
        load_in_4bit=True,
    )

    model = FastLanguageModel.get_peft_model(
        model,
        r=LORA_R,
        target_modules=["q_proj","k_proj","v_proj","o_proj","gate_proj","up_proj","down_proj"],
        lora_alpha=LORA_R * 2,
        lora_dropout=0,
        bias="none",
        use_gradient_checkpointing="unsloth",
        random_state=42,
        max_seq_length=MAX_SEQ,
    )

    rows = load_data()
    examples = format_data(rows)
    
    split = int(len(examples) * 0.9)
    dataset = DatasetDict({
        "train": Dataset.from_list(examples[:split]),
        "eval": Dataset.from_list(examples[split:]),
    })

    print(f"[Train] Train: {len(dataset['train'])} | Eval: {len(dataset['eval'])}")

    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=dataset["train"],
        eval_dataset=dataset["eval"],
        args=TrainingArguments(
            output_dir=OUTPUT_DIR,
            num_train_epochs=EPOCHS,
            per_device_train_batch_size=BATCH_SIZE,
            gradient_accumulation_steps=4,
            warmup_steps=10,
            learning_rate=LR,
            fp16=not is_bfloat16_supported(),
            bf16=is_bfloat16_supported(),
            logging_steps=1,
            evaluation_strategy="epoch",
            save_strategy="epoch",
            save_total_limit=2,
            load_best_model_at_end=True,
            report_to="none",
        ),
        max_seq_length=MAX_SEQ,
        packing=False,
    )

    print("[Train] Starting training...")
    trainer.train()

    print(f"[Train] Saving to {OUTPUT_DIR}")
    model.save_pretrained(OUTPUT_DIR)
    tokenizer.save_pretrained(OUTPUT_DIR)

    try:
        model.save_pretrained_gguf(OUTPUT_DIR, tokenizer, quantization_method="q4_k_m")
        print(f"[Train] GGUF adapter saved")
    except Exception as e:
        print(f"[Train] GGUF export skipped: {e}")

    with open(f"{OUTPUT_DIR}/genres.json", "w") as f:
        json.dump(GENRES, f, indent=2)
    
    # Create Ollama Modelfile
    with open(f"{OUTPUT_DIR}/Modelfile", "w") as f:
        f.write(f"FROM qwen2.5:7b\nADAPTER ./qwen2.5-7b-lora.Q4_K_M.gguf\n")
    
    print(f"[Train] Done! Use: ollama create blindtest-classifier -f {OUTPUT_DIR}/Modelfile")

if __name__ == "__main__":
    train()
