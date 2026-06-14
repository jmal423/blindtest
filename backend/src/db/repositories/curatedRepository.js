import { pool, all } from '../connection.js';

export async function getCuratedSongsByGenre(genre, count) {
  const { rows } = await pool.query(
    `SELECT * FROM curated_songs
     WHERE genre = $1 AND verified = TRUE
     ORDER BY played_count ASC, RANDOM()
     LIMIT $2`,
    [genre, count]
  );
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    artist: r.artist,
    albumImage: r.album_image,
    previewUrl: r.preview_url, // may be stale — refresh before game
    durationMs: r.duration_ms,
    genre: r.genre,
    albumGenres: typeof r.album_genres === 'string' ? JSON.parse(r.album_genres) : (r.album_genres || []),
    playedCount: r.played_count,
    verified: r.verified,
    chartSource: r.chart_source,
    rawId: r.id.replace('deezer:', ''),
  }));
}

export async function getSongsByArtist(artist, count) {
  // First try curated_songs to respect played_count
  const { rows: curatedRows } = await pool.query(
    `SELECT id, name, artist, album_image as "albumImage", 
            preview_url as "previewUrl", duration_ms as "durationMs", 
            genre, album_genres as "albumGenres", played_count
     FROM curated_songs
     WHERE artist ILIKE $1 AND preview_url IS NOT NULL
     ORDER BY played_count ASC, RANDOM()
     LIMIT $2`,
    [`%${artist}%`, count]
  );

  let results = curatedRows.map(r => ({
    id: r.id,
    name: r.name,
    artist: r.artist,
    albumImage: r.albumImage,
    previewUrl: r.previewUrl,
    durationMs: r.durationMs,
    genre: r.genre || 'artist_mode',
    albumGenres: typeof r.albumGenres === 'string' ? JSON.parse(r.albumGenres) : (r.albumGenres || []),
    rawId: r.id.replace('deezer:', ''),
  }));

  if (results.length >= count) return results;

  // Fallback to songs_cache for additional tracks
  const { rows: cacheRows } = await pool.query(
    `SELECT sc.id, sc.name, sc.artist, sc.album_image as "albumImage", 
            sc.preview_url as "previewUrl", sc.duration_ms as "durationMs", 
            sc.genre, sc.genres as "albumGenres"
     FROM songs_cache sc
     WHERE sc.artist ILIKE $1 AND sc.preview_url IS NOT NULL
     ORDER BY RANDOM()
     LIMIT $2`,
    [`%${artist}%`, count]
  );
  
  const existingIds = new Set(results.map(r => r.id));
  for (const r of cacheRows) {
    if (!existingIds.has(r.id)) {
      results.push({
        id: r.id,
        name: r.name,
        artist: r.artist,
        albumImage: r.albumImage,
        previewUrl: r.previewUrl,
        durationMs: r.durationMs,
        genre: r.genre || 'artist_mode',
        albumGenres: typeof r.albumGenres === 'string' ? JSON.parse(r.albumGenres) : (r.albumGenres || []),
        rawId: r.id.replace('deezer:', ''),
      });
    }
    if (results.length >= count) break;
  }

  return results;
}


export async function countCuratedSongsByGenre(genre) {
  const { rows } = await pool.query(
    `SELECT COUNT(*) as count FROM curated_songs WHERE genre = $1 AND verified = TRUE`,
    [genre]
  );
  return parseInt(rows[0].count, 10);
}

export async function getCuratedSongIds() {
  const { rows } = await pool.query(`SELECT id FROM curated_songs`);
  return new Set(rows.map(r => r.id));
}

export async function addCuratedSong(song) {
  await pool.query(
    `INSERT INTO curated_songs (id, name, artist, album_image, preview_url, duration_ms, genre, album_genres, chart_source, verified)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)
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
  await pool.query(
    `UPDATE curated_songs SET played_count = played_count + 1, last_played_at = NOW()
     WHERE id = $1`,
    [songId]
  );
}

export async function setCuratedVerified(songId, verified) {
  await pool.query(
    `UPDATE curated_songs SET verified = $2 WHERE id = $1`,
    [songId, verified]
  );
}

export async function getCuratedSongsStats() {
  const { rows } = await pool.query(`
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE verified = TRUE) AS verified,
      COUNT(*) FILTER (WHERE verified = FALSE) AS unverified,
      COALESCE(SUM(played_count), 0) AS total_plays,
      (SELECT COUNT(DISTINCT genre) FROM curated_songs) AS genres
    FROM curated_songs
  `);
  return rows[0];
}

export async function getCuratedSongsByGenreGrouped() {
  const { rows } = await pool.query(`
    SELECT genre, COUNT(*) AS total,
           COUNT(*) FILTER (WHERE verified = TRUE) AS verified,
           COALESCE(SUM(played_count), 0) AS total_plays
    FROM curated_songs
    GROUP BY genre
    ORDER BY genre
  `);
  return rows;
}

export async function getDiscoveryCandidates(genre, limit = 20) {
  return all(
    `SELECT sc.id, sc.name, sc.artist, sc.preview_url, sc.duration_ms,
            sc.genre, sc.genres, sc.chart_source, sc.rank
     FROM songs_cache sc
     LEFT JOIN curated_songs cs ON cs.id = sc.id
     WHERE cs.id IS NULL
       AND (sc.genres @> ?::jsonb OR sc.genre = ? OR sc.ai_genres @> ?::jsonb)
       AND sc.preview_url IS NOT NULL
     ORDER BY sc.rank DESC
     LIMIT ?`,
    [JSON.stringify([genre]), genre, JSON.stringify([genre]), limit]
  );
}
