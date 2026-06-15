export default {
  name: 'song_flags',
  up: `
    CREATE TABLE IF NOT EXISTS song_flags (
      id TEXT PRIMARY KEY,
      song_id TEXT NOT NULL,
      player_id TEXT NOT NULL,
      room_code TEXT,
      reason TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_song_flags_song ON song_flags(song_id);
    CREATE INDEX IF NOT EXISTS idx_song_flags_player ON song_flags(player_id);
  `,
};
