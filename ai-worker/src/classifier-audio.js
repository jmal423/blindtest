import { spawn } from 'node:child_process';
import { config } from './config.js';
import { GENRES } from './genres.js';

async function downloadPreview(trackId) {
  const url = `${config.deezerApiBase}/track/${trackId.replace('deezer:', '')}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Deezer track lookup failed: ${res.status}`);

  const data = await res.json();
  if (!data.preview) throw new Error('No preview URL for track');

  const audioRes = await fetch(data.preview);
  if (!audioRes.ok) throw new Error(`Failed to download preview: ${audioRes.status}`);

  const buffer = await audioRes.arrayBuffer();
  return Buffer.from(buffer);
}

function runPythonClassifier(audioBuffer) {
  return new Promise((resolve, reject) => {
    const proc = spawn('python3', [
      '-c', `
import sys, json, io, tempfile, os
try:
    import numpy as np
    import librosa
    import onnxruntime as ort
except ImportError:
    print(json.dumps({"genres": [], "error": "Missing python deps: numpy, librosa, onnxruntime"}))
    sys.exit(0)

model_path = "${config.audioModelPath.replace(/\\/g, '/')}"
if not os.path.exists(model_path):
    print(json.dumps({"genres": [], "error": "Model not found at " + model_path}))
    sys.exit(0)

audio_bytes = sys.stdin.buffer.read()
with tempfile.NamedTemporaryFile(suffix='.mp3', delete=False) as f:
    f.write(audio_bytes)
    tmp_path = f.name

try:
    y, sr = librosa.load(tmp_path, sr=22050, mono=True, duration=30)
    os.unlink(tmp_path)
    mel = librosa.feature.melspectrogram(y=y, sr=sr, n_mels=96, fmax=8000)
    mel_db = librosa.power_to_db(mel, ref=np.max)
    target_frames = 96
    if mel_db.shape[1] < target_frames:
        pad = target_frames - mel_db.shape[1]
        mel_db = np.pad(mel_db, ((0,0), (0,pad)), mode='constant')
    else:
        mel_db = mel_db[:, :target_frames]
    input_tensor = mel_db[np.newaxis, np.newaxis, :, :].astype(np.float32)

    session = ort.InferenceSession(model_path)
    input_name = session.get_inputs()[0].name
    output = session.run(None, {input_name: input_tensor})[0]
    probs = output[0]

    genre_labels = ${JSON.stringify(GENRES)}
    threshold = 0.3
    predictions = [(genre_labels[i], float(probs[i])) for i in range(len(genre_labels)) if float(probs[i]) >= threshold]
    predictions.sort(key=lambda x: -x[1])

    result = {
        "genres": [g for g, _ in predictions],
        "confidence": {g: c for g, c in predictions}
    }
    print(json.dumps(result))
except Exception as e:
    try: os.unlink(tmp_path)
    except: pass
    print(json.dumps({"genres": [], "error": str(e)}))
      `,
    ]);

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      if (code !== 0 && !stdout) {
        reject(new Error(`Python classifier exited ${code}: ${stderr}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error(`Failed to parse python output: ${stdout.slice(0, 200)}`));
      }
    });
    proc.on('error', reject);
    proc.stdin.end(audioBuffer);
  });
}

export async function classifyAudio(track) {
  if (!config.audioEnabled) {
    return { genres: [], confidence: {}, skipped: true };
  }

  let audioBuffer;
  try {
    audioBuffer = await downloadPreview(track.id);
  } catch (err) {
    console.warn(`[Audio] Skipping ${track.id} — ${err.message}`);
    return { genres: [], confidence: {}, error: err.message };
  }

  const result = await runPythonClassifier(audioBuffer);

  if (result.error) {
    console.warn(`[Audio] Classification error for ${track.id}: ${result.error}`);
  }

  const validGenres = (result.genres || []).filter(g => GENRES.includes(g));
  const confidence = {};
  for (const g of validGenres) {
    confidence[g] = result.confidence?.[g] || 0.5;
  }

  return { genres: validGenres, confidence };
}
