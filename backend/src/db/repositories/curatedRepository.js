import { all, run, get } from '../connection.js';

function mapSongRow(r) {
  return {
    id: r.id,
    name: r.name,
    artist: r.artist,
    albumImage: r.album_image,
    previewUrl: r.preview_url,
    durationMs: r.duration_ms,
    genre: r.genre,
    albumGenres: typeof r.album_genres === 'string' ? JSON.parse(r.album_genres) : (r.album_genres || []),
    playedCount: r.played_count,
    verified: r.verified,
    chartSource: r.chart_source,
    rawId: r.id.replace('deezer:', ''),
  };
}

export async function getCuratedSongsByGenre(genre, count) {
  const rows = await all(
    `SELECT * FROM curated_songs
     WHERE genre = ? AND verified = TRUE
     ORDER BY played_count ASC, RANDOM()
     LIMIT ?`,
    [genre, count]
  );
  return rows.map(mapSongRow);
}

export async function getCuratedSongsByGenreRaw(genre) {
  return all(
    `SELECT id, name, artist, genre, played_count, verified, curated_at, last_played_at, preview_url,
            preview_url IS NOT NULL as has_preview
     FROM curated_songs
     WHERE genre = ?
     ORDER BY played_count DESC, curated_at DESC`,
    [genre]
  );
}

export async function getUnverifiedCuratedSongs(limit, offset, search) {
  if (search) {
    const rows = await all(
      `SELECT id, name, artist, genre, played_count, verified, curated_at, last_played_at, preview_url,
              preview_url IS NOT NULL as has_preview
       FROM curated_songs
       WHERE verified = FALSE AND (name ILIKE ? OR artist ILIKE ?)
       ORDER BY curated_at DESC
       LIMIT ? OFFSET ?`,
      [`%${search}%`, `%${search}%`, limit, offset]
    );
    const [{ count } = { count: 0 }] = await all(
      `SELECT COUNT(*) as count FROM curated_songs WHERE verified = FALSE AND (name ILIKE ? OR artist ILIKE ?)`,
      [`%${search}%`, `%${search}%`]
    );
    return { songs: rows, total: Number(count) };
  }

  const rows = await all(
    `SELECT id, name, artist, genre, played_count, verified, curated_at, last_played_at, preview_url,
            preview_url IS NOT NULL as has_preview
     FROM curated_songs
     WHERE verified = FALSE
     ORDER BY curated_at DESC
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  const [{ count } = { count: 0 }] = await all(
    'SELECT COUNT(*) as count FROM curated_songs WHERE verified = FALSE'
  );
  return { songs: rows, total: Number(count) };
}

export async function countCuratedSongsByGenre(genre) {
  const [row] = await all(
    'SELECT COUNT(*) as count FROM curated_songs WHERE genre = ? AND verified = TRUE',
    [genre]
  );
  return parseInt(row?.count || '0', 10);
}

export async function getCuratedSongIds() {
  const rows = await all('SELECT id FROM curated_songs');
  return new Set(rows.map(r => r.id));
}

export async function addCuratedSong(song) {
  await run(
    `INSERT INTO curated_songs (id, name, artist, album_image, preview_url, duration_ms, genre, album_genres, chart_source, verified)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?)
     ON CONFLICT (id) DO NOTHING`,
    [
      song.id, song.name, song.artist, song.albumImage || null,
      song.previewUrl || null, song.durationMs || 0,
      song.genre, JSON.stringify(song.albumGenres || []),
      song.chartSource || null, song.verified !== false,
    ]
  );
}

export async function incrementCuratedPlayedCount(songId) {
  await run(
    `UPDATE curated_songs SET played_count = played_count + 1, last_played_at = NOW()
     WHERE id = ?`,
    [songId]
  );
}

export async function setCuratedVerified(songId, verified) {
  await run(
    'UPDATE curated_songs SET verified = ? WHERE id = ?',
    [verified, songId]
  );
}

export async function updateCuratedSongGenre(songId, genre) {
  await run(
    'UPDATE curated_songs SET genre = ? WHERE id = ?',
    [genre, songId]
  );
}

export async function getCuratedSongsStats() {
  const [row] = await all(`
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE verified = TRUE) AS verified,
      COUNT(*) FILTER (WHERE verified = FALSE) AS unverified,
      COALESCE(SUM(played_count), 0) AS total_plays,
      (SELECT COUNT(DISTINCT genre) FROM curated_songs) AS genres
    FROM curated_songs
  `);
  return row;
}

export async function getCuratedSongsByGenreGrouped() {
  return all(`
    SELECT genre, COUNT(*) AS total,
           COUNT(*) FILTER (WHERE verified = TRUE) AS verified,
           COALESCE(SUM(played_count), 0) AS total_plays
    FROM curated_songs
    GROUP BY genre
    ORDER BY genre
  `);
}
