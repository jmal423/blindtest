# Model Training

## Prerequisites
- Python 3.10+ with pip
- CUDA or ROCm compatible GPU (8GB+ VRAM)
- Access to the PostgreSQL database (OptiPlex at 192.168.1.49)

## Setup
```bash
pip install -r requirements.txt
```

For ROCm (AMD GPUs like RX 9070 XT) on Linux:
```bash
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/rocm6.2
pip install unsloth
```

## Export Training Data
```bash
python export-data.py training-data.csv
```

## Train
The training script:
1. Loads all classified tracks (confidence >= 0.5, excluding UNCLASSIFIED/GL_other)
2. Uses the latest classification per track
3. Fine-tunes Qwen2.5-3B-Instruct with LoRA (r=16)
4. Saves adapter + merged model to `./lora-adapter/`
5. Creates a `Modelfile` for Ollama

```bash
# Set database URL
export DATABASE_URL="postgresql://jalfaiat:Eelflpbqjv2003!@192.168.1.49:5432/blindtest"

# Run training
python train.py
```

## Deploy to Ollama
After training completes:
```bash
ollama create blindtest-classifier -f ./lora-adapter/Modelfile
```

Then update the AI worker config to use the new version and re-run:
```bash
cd ..
node src/index.js --mode=batch
```

## Note on Old Schema
The train.py was updated (Jun 2026) to query `tracks` + `classifications` + `curation` tables
instead of the old `songs_cache` + `curated_songs` tables which were removed in migration 018.
