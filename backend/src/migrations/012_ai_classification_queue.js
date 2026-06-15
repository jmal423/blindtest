export default {
  name: 'ai_classification_queue',
  up: `
    CREATE TABLE IF NOT EXISTS ai_classification_queue (
      id TEXT PRIMARY KEY,
      song_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      priority INTEGER DEFAULT 0,
      error TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      processed_at TIMESTAMPTZ
    );

    CREATE INDEX IF NOT EXISTS idx_ai_queue_status ON ai_classification_queue(status);
    CREATE INDEX IF NOT EXISTS idx_ai_queue_priority ON ai_classification_queue(priority);
  `,
};
