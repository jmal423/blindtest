import { getCustomGenreTracks } from './deezer.js';

const TARGET = 50;

const GENRE_LIST = [
  'UNCLASSIFIED','PT_fado','PT_tradicional_folklore_pimba','PT_pop_tuga','PT_pop_rock_tuga',
  'PT_hip_hop_tuga','PT_classica_tuga','PT_kizomba_palop','PT_pop_urbano_nova_pop',
  'BR_samba_pagode','BR_bossa_nova','BR_funk_brasileiro','BR_pop_rock_brasileiro','BR_pop',
  'US_pop_us','US_hip_hop_trap_us','US_country_americana_us','US_rock_alternative_us',
  'UK_pop_uk','UK_uk_drill_grime','UK_britpop_rock_uk','UK_uk_garage_dnb',
  'FR_chanson_francaise','FR_pop_francaise','FR_rap_francais','FR_french_touch_electro',
  'ES_flamenco','ES_reggaeton_urbano','ES_musica_regional_latina',
  'GL_reggae','GL_kpop','GL_edm_dance','GL_afrobeats_african','GL_metal','GL_soundtracks',
  'GL_jazz_lounge','GL_classical','GL_kids_family','GL_indian','GL_other',
];

const DEEZER_MAP = {
  'funk-brasileiro': 'BR_funk_brasileiro', 'chanson-francaise': 'FR_chanson_francaise',
  'french-rap': 'FR_rap_francais', 'rap-francais': 'FR_rap_francais',
  'metal': 'GL_metal', 'k-pop': 'GL_kpop', 'kpop': 'GL_kpop',
  'reggae': 'GL_reggae', 'dance': 'GL_edm_dance', 'edm': 'GL_edm_dance',
  'electro': 'GL_edm_dance', 'house': 'GL_edm_dance', 'techno': 'GL_edm_dance',
  'jazz': 'GL_jazz_lounge', 'lounge': 'GL_jazz_lounge',
  'soundtrack': 'GL_soundtracks', 'classical': 'GL_classical', 'classique': 'GL_classical',
  'kids': 'GL_kids_family', 'children': 'GL_kids_family', 'family': 'GL_kids_family',
  'indian': 'GL_indian', 'bollywood': 'GL_indian',
  'fado': 'PT_fado', 'samba': 'BR_samba_pagode', 'bossa': 'BR_bossa_nova',
  'rock': 'US_rock_alternative_us',
};

export async function fillGenre(genreId, db) {
  const startTime = Date.now();
  const row = await db.get('SELECT COUNT(*)::int as c FROM curation WHERE genre_id = ?', [genreId]);
  const currentCount = row?.c || 0;
  const needed = TARGET - currentCount;
  if (needed <= 0) return { ok: true, message: `Already ${currentCount} songs (>= ${TARGET})`, added: 0, details: [] };

  console.log(`[Fill] ${genreId}: have ${currentCount}, need ${needed} more`);

  // 1. Fetch from Deezer
  const fetchLimit = Math.min(needed * 2, 100);
  const tracks = await getCustomGenreTracks(genreId, fetchLimit);
  if (tracks.length === 0) return { ok: false, message: `No Deezer tracks found for ${genreId}`, added: 0, details: [] };

  // 2. Cache to tracks table
  const { cacheSongs } = await import('./db.js');
  await cacheSongs(tracks);

  // 3. Classify via Ollama and curate
  const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
  const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'blindtest-classifier';
  const details = [];

  for (const t of tracks) {
    const entry = { name: t.name, artist: t.artist, deezerTags: t.genres || [], aiGenre: null, curated: false, error: null };

    let matched = 'UNCLASSIFIED';

    // 1. Try Ollama classification (optional)
    try {
      const res = await fetch(`${OLLAMA_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          prompt: `Track: "${t.name}" by ${t.artist}\nGenre:`,
          stream: false,
          options: { temperature: 0, num_predict: 50 },
        }),
      });
      const data = await res.json();
      const raw = (data.response || '').trim();
      entry.rawOutput = raw;

      for (const g of GENRE_LIST) {
        if (g !== 'UNCLASSIFIED' && raw.startsWith(g)) { matched = g; break; }
      }
    } catch (err) {
      entry.error = err.message;
    }

    // 2. Override with Deezer tags (always runs, Ollama or not)
    if (t.genres && t.genres.length) {
      for (const tag of t.genres) {
        const key = (tag || '').toLowerCase().trim();
        if (DEEZER_MAP[key]) { matched = DEEZER_MAP[key]; break; }
        const direct = GENRE_LIST.find(g => g.toLowerCase() === key);
        if (direct) { matched = direct; break; }
      }
    }

    // 3. Fallback: track came from a Deezer playlist for this genre, trust it
    if (matched === 'UNCLASSIFIED' && genreId !== 'UNCLASSIFIED' && genreId !== 'GL_other') {
      matched = genreId;
    }

    entry.aiGenre = matched;

    // 4. Always insert classification + curation if we have a valid match
    if (matched !== 'UNCLASSIFIED' && matched !== 'GL_other') {
      await db.run(
        `INSERT INTO classifications (track_id, genre_id, confidence, source, created_at)
         VALUES (?, ?, 0.9, 'ai:blindtest-classifier-v5-fill', NOW()) ON CONFLICT DO NOTHING`,
        [t.id, matched]
      );

      if (matched === genreId) {
        await db.run(
          `INSERT INTO curation (track_id, genre_id, verified, curated_by, curated_at)
           VALUES (?, ?, true, 'auto-fill', NOW()) ON CONFLICT (track_id) DO NOTHING`,
          [t.id, genreId]
        );
        entry.curated = true;
      }
    }
    details.push(entry);
  }

  const added = details.filter(d => d.curated).length;
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[Fill] ${genreId}: ${added}/${tracks.length} curated in ${elapsed}s`);

  return {
    ok: true,
    message: `Added ${added}/${tracks.length} songs to ${genreId} in ${elapsed}s`,
    added,
    total: tracks.length,
    elapsed: parseFloat(elapsed),
    details,
  };
}
