import { run, all, get } from '../connection.js';

export async function addSongFlag(id, songId, playerId, roomCode, reason) {
  await run(
    `INSERT INTO song_flags (id, song_id, player_id, room_code, reason)
     VALUES (?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING`,
    [id, songId, playerId, roomCode, reason]
  );
}

export async function getFlagCount(songId) {
  const [row] = await all(
    'SELECT COUNT(DISTINCT player_id) as cnt FROM song_flags WHERE song_id = ?',
    [songId]
  );
  return parseInt(row?.cnt || '0', 10);
}

export async function getPlayerFlagCountInGame(playerId, roomCode) {
  const [row] = await all(
    'SELECT COUNT(*) as cnt FROM song_flags WHERE player_id = ? AND room_code = ?',
    [playerId, roomCode]
  );
  return parseInt(row?.cnt || '0', 10);
}

export async function getFlaggedSongs(limit = 50, offset = 0) {
  const rows = await all(`
    SELECT sf.song_id, cs.name, cs.artist, cs.genre,
           COUNT(DISTINCT sf.player_id) as flag_count,
           jsonb_object_agg(sf.reason, sf.cnt) as reasons
    FROM (
      SELECT song_id, reason, COUNT(*) as cnt
      FROM song_flags
      GROUP BY song_id, reason
    ) sf
    LEFT JOIN curated_songs cs ON cs.id = sf.song_id
    GROUP BY sf.song_id, cs.name, cs.artist, cs.genre
    ORDER BY flag_count DESC, MAX(sf.cnt) DESC
    LIMIT ? OFFSET ?
  `, [limit, offset]);
  return rows;
}

export async function dismissSongFlags(songId) {
  await run('DELETE FROM song_flags WHERE song_id = ?', [songId]);
}
