from transformers import AutoModelForCausalLM, AutoTokenizer

model_path = './lora-adapter/merged'
tokenizer = AutoTokenizer.from_pretrained(model_path, trust_remote_code=True)
model = AutoModelForCausalLM.from_pretrained(model_path, torch_dtype='auto', device_map='auto', trust_remote_code=True)

test_songs = [
    ("Soltera", "Shakira", "ES_reggaeton_urbano"),
    ("Telefone", "Luísa Sonza", "BR_pop"),
    ("Espresso", "Sabrina Carpenter", "US_pop_us"),
    ("Not Like Us", "Kendrick Lamar", "US_hip_hop_trap_us"),
    ("Around the World", "Daft Punk", "FR_french_touch_electro"),
    ("Du hast", "Rammstein", "GL_metal"),
    ("CRAZY", "LE SSERAFIM", "GL_kpop"),
]

correct = 0
for name, artist, expected in test_songs:
    prompt = f'Track: "{name}" by {artist}\nGenre:'
    inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
    out = model.generate(**inputs, max_new_tokens=15, do_sample=False)
    new_tokens = out[0][len(inputs.input_ids[0]):]
    tokens = [tokenizer.decode([t], skip_special_tokens=True) for t in new_tokens]
    genre = "".join(tokens).strip()

    ok = "[OK]" if genre.startswith(expected) else "[MISS]"
    if genre.startswith(expected): correct += 1
    print(f"  {ok} {name:30s} - {artist:20s} => {genre[:50]:50s} (expected: {expected})")

print(f"\nAccuracy: {correct}/{len(test_songs)} ({correct*100//len(test_songs)}%)")
