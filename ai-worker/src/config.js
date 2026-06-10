import 'dotenv/config';

export const config = {
  databaseUrl: process.env.DATABASE_URL,
  ollamaUrl: process.env.OLLAMA_URL || 'http://127.0.0.1:11434',
  ollamaModel: process.env.OLLAMA_MODEL || 'llama3.2',
  batchSize: parseInt(process.env.BATCH_SIZE || '25', 10),
  concurrency: parseInt(process.env.CONCURRENCY || '5', 10),
  pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || '60000', 10),
  audioEnabled: process.env.AUDIO_CLASSIFICATION_ENABLED === 'true',
  audioModelPath: process.env.AUDIO_MODEL_PATH || './models/musicnn.onnx',
  aiVersion: process.env.AI_VERSION || 'llama3.2-v1',
  deezerApiBase: 'https://api.deezer.com',
};
