import { query, get, all, run } from '../connection.js';

function mapRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    artist: r.artist_name || r.artist,
    artistName: r.artist_name,
    albumImage: r.album_image,
    previewUrl: r.preview_url,
    durationMs: r.duration_ms,
    rank: r.rank,
    chartSource: r.chart_source,
    deezerGenres: typeof r.deezer_genres === 'string' ? JSON.parse(r.deezer_genres) : (r.deezer_genres || []),
    rawId: r.raw_id || (r.id ? r.id.replace('deezer:', '') : null),
    genre: r.genre,
    verified: r.verified,
    curatedBy: r.curated_by,
    curatedAt: r.curated_at,
    playedCount: r.played_count || r.playedCount || 0,
    foundCount: r.found_count,
    lastPlayed: r.last_played,
    albumGenres: r.album_genres ? (typeof r.album_genres === 'string' ? JSON.parse(r.album_genres) : r.album_genres) : [],
  };
}

function mapRows(rows) {
  return rows.map(mapRow);
}

// ─── Curation Queries ─────────────────────────────────────────

export async function getCuratedSongsByGenre(genre, count) {
  const rows = await all(
    `SELECT t.id, t.name, t.artist_name, t.album_image, t.preview_url,
            t.duration_ms, t.rank, t.chart_source, t.deezer_genres,
            REPLACE(t.id, 'deezer:', '') as raw_id,
            cu.genre_id as genre, cu.verified,
            cu.played_count, cu.found_count, cu.last_played,
            cu.curated_at
     FROM curation cu
     JOIN tracks t ON t.id = cu.track_id
     WHERE cu.genre_id = ? AND cu.verified = TRUE
     ORDER BY RANDOM()
     LIMIT ?`,
    [genre, count]
  );
  return mapRows(rows);
}

export async function getCuratedSongsByGenreRaw(genre) {
  const rows = await all(
    `SELECT t.id, t.name, t.artist_name, t.album_image, t.preview_url,
            t.duration_ms, t.rank, t.chart_source, t.deezer_genres,
            REPLACE(t.id, 'deezer:', '') as raw_id,
            cu.genre_id as genre, cu.verified, cu.curated_by,
            cu.curated_at, cu.played_count, cu.found_count, cu.last_played
     FROM curation cu
     JOIN tracks t ON t.id = cu.track_id
     WHERE cu.genre_id = ?
     ORDER BY cu.played_count DESC, cu.curated_at DESC`,
    [genre]
  );
  return mapRows(rows);
}

export async function getUnverifiedCuratedSongs(limit, offset, search) {
  if (search) {
    const like = `%${search}%`;
    const rows = await all(
      `SELECT t.id, t.name, t.artist_name, t.album_image, t.preview_url,
              t.duration_ms, t.rank, t.chart_source, t.deezer_genres,
              REPLACE(t.id, 'deezer:', '') as raw_id,
              cu.genre_id as genre, cu.verified, cu.curated_by,
              cu.curated_at, cu.played_count, cu.found_count, cu.last_played
       FROM curation cu
       JOIN tracks t ON t.id = cu.track_id
       WHERE cu.verified = FALSE
         AND (t.name ILIKE ? OR t.artist_name ILIKE ?)
       ORDER BY cu.curated_at DESC
       LIMIT ? OFFSET ?`,
      [like, like, limit, offset]
    );
    const countRow = await get(
      `SELECT COUNT(*) as count
       FROM curation cu
       JOIN tracks t ON t.id = cu.track_id
       WHERE cu.verified = FALSE
         AND (t.name ILIKE ? OR t.artist_name ILIKE ?)`,
      [like, like]
    );
    return { songs: mapRows(rows), total: countRow.count };
  }

  const rows = await all(
    `SELECT t.id, t.name, t.artist_name, t.album_image, t.preview_url,
            t.duration_ms, t.rank, t.chart_source, t.deezer_genres,
            REPLACE(t.id, 'deezer:', '') as raw_id,
            cu.genre_id as genre, cu.verified, cu.curated_by,
            cu.curated_at, cu.played_count, cu.found_count, cu.last_played
     FROM curation cu
     JOIN tracks t ON t.id = cu.track_id
     WHERE cu.verified = FALSE
     ORDER BY cu.curated_at DESC
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  const countRow = await get(`SELECT COUNT(*) as count FROM curation WHERE verified = FALSE`);
  return { songs: mapRows(rows), total: countRow.count };
}

export async function countCuratedSongsByGenre(genre) {
  const row = await get(
    `SELECT COUNT(*) as count FROM curation WHERE genre_id = ? AND verified = TRUE`,
    [genre]
  );
  return row.count;
}

export async function getCuratedSongIds() {
  const rows = await all(`SELECT track_id as id FROM curation`);
  return new Set(rows.map(r => r.id));
}

export async function addCuratedSong(song) {
  await run(
    `INSERT INTO curation (track_id, genre_id, verified, curated_by, curated_at)
     VALUES (?, ?, ?, ?, NOW())
     ON CONFLICT (track_id) DO UPDATE SET
       genre_id = EXCLUDED.genre_id,
       verified = EXCLUDED.verified,
       curated_by = EXCLUDED.curated_by,
       curated_at = EXCLUDED.curated_at`,
    [song.id, song.genre, song.verified || false, song.curated_by || 'admin:unknown']
  );

  await run(
    `INSERT INTO tracks (id, name, artist_name, album_image, preview_url, duration_ms)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO NOTHING`,
    [song.id, song.name, song.artist, song.album_image, song.preview_url, song.duration_ms || 0]
  );
}

export async function incrementCuratedPlayedCount(songId) {
  await run(
    `UPDATE curation SET played_count = played_count + 1, last_played = NOW() WHERE track_id = ?`,
    [songId]
  );
}

export async function setCuratedVerified(songId, verified) {
  await run(`UPDATE curation SET verified = ? WHERE track_id = ?`, [verified, songId]);
}

export async function updateCuratedSongGenre(songId, genre) {
  await run(`UPDATE curation SET genre_id = ? WHERE track_id = ?`, [genre, songId]);
}

export async function getCuratedSongsStats() {
  return get(
    `SELECT
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE verified = TRUE) AS verified,
       COUNT(*) FILTER (WHERE verified = FALSE) AS unverified,
       COALESCE(SUM(played_count), 0) AS total_plays,
       (SELECT COUNT(DISTINCT genre_id) FROM curation) AS genres
     FROM curation`
  );
}

export async function getCuratedSongsByGenreGrouped() {
  return all(
    `SELECT genre_id as genre, COUNT(*) AS total,
            COUNT(*) FILTER (WHERE verified = TRUE) AS verified,
            COALESCE(SUM(played_count), 0) AS total_plays
     FROM curation
     GROUP BY genre_id
     ORDER BY genre_id`
  );
}
