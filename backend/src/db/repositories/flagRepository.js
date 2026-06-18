import { query, get, all, run } from '../connection.js';

export async function addSongFlag(id, songId, playerId, roomCode, reason) {
  await run(
    `INSERT INTO song_flags (id, track_id, player_id, game_code, reason)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (id) DO NOTHING`,
    [id, songId, playerId, roomCode, reason]
  );
}

export async function getFlagCount(songId) {
  const row = await get(
    `SELECT COUNT(DISTINCT player_id) as cnt FROM song_flags WHERE track_id = ?`,
    [songId]
  );
  return row.cnt;
}

export async function getPlayerFlagCountInGame(playerId, roomCode) {
  const row = await get(
    `SELECT COUNT(*) as cnt FROM song_flags WHERE player_id = ? AND game_code = ?`,
    [playerId, roomCode]
  );
  return row.cnt;
}

export async function getFlaggedSongs(limit, offset) {
  return all(
    `SELECT
       sf.track_id as song_id,
       t.name,
       t.artist_name as artist,
       cu.genre_id as genre,
       (SELECT COUNT(DISTINCT f2.player_id) FROM song_flags f2 WHERE f2.track_id = sf.track_id) as flag_count,
       jsonb_object_agg(sf.reason, sf.cnt) as reasons
     FROM (
       SELECT track_id, reason, COUNT(*) as cnt
       FROM song_flags
       GROUP BY track_id, reason
     ) sf
     LEFT JOIN tracks t ON t.id = sf.track_id
     LEFT JOIN curation cu ON cu.track_id = sf.track_id
     GROUP BY sf.track_id, t.name, t.artist_name, cu.genre_id
     ORDER BY (SELECT MAX(created_at) FROM song_flags WHERE track_id = sf.track_id) DESC
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );
}

export async function dismissSongFlags(songId) {
  await run(
    `DELETE FROM song_flags WHERE track_id = ?`,
    [songId]
  );
}
