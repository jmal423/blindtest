import { writeFileSync } from 'node:fs';

const DEEZER_API = 'https://api.deezer.com';
const TARGET_PER_GENRE = 200;
const OUTPUT_FILE = 'training-data.jsonl';

const GENRE_PLAYLISTS = {
  PT_fado: [2734677584, 10613220962, 4782723304, 14974361323],
  PT_tradicional_folklore_pimba: [1478605935, 6163368884, 14302375881, 15135817403, 4782723304, 13980025901, 3835511186, 13493798923],
  PT_pop_tuga: [3562194622, 5898788844],
  PT_pop_rock_tuga: [3562194622, 5898788844, 10642447282],
  PT_hip_hop_tuga: [3481848302, 15066013003, 8211186722],
  PT_classica_tuga: [8048810122, 12356713983, 14476568723, 15102890763],
  PT_kizomba_palop: [4427293502, 1205831211, 3311387182, 1839099582],
  PT_pop_urbano_nova_pop: [14341944421, 11555475044, 15060016783],
  BR_samba_pagode: [5449764382, 5709940122, 12968855623, 3396745906],
  BR_bossa_nova: [556502217, 12607436323, 11566444484, 15172273023],
  BR_funk_brasileiro: [15204407463, 15355968343, 15126778163, 9743264302],
  BR_pop: [3155776882, 11629851604, 12431698623],
  BR_pop_rock_brasileiro: [9268293682, 11532710604, 11271619264],
  US_pop_us: [1282483245],
  US_hip_hop_trap_us: [12547421383],
  US_country_americana_us: [11336583364, 14013464681, 9195238842, 7688601282],
  US_rock_alternative_us: [1318451857, 8074584322, 8716319082, 8929584182, 1402845615],
  UK_pop_uk: [14645078321, 15199165723, 8603778582, 7386651364],
  UK_uk_drill_grime: [10361171462, 8322893622, 11336030544, 8672240222, 14701050621],
  UK_britpop_rock_uk: [8715045762, 9066452562, 855150871],
  UK_uk_garage_dnb: [14596222441, 14268860961, 13809941261, 11374785584, 3274357942],
  FR_chanson_francaise: [700895155, 1884320402, 957995855, 1420459465],
  FR_pop_francaise: [1235433511, 1021647001, 1067140111, 1280262301],
  FR_french_touch_electro: [962293895, 13065304003, 7281037904, 9197791042, 6300460544, 7342240164],
  FR_rap_francais: [6568026624, 8619246462, 15155137203, 1836636662],
  ES_flamenco: [777756285, 3582568026, 13941285401, 15148096583, 6177686164],
  ES_reggaeton_urbano: [178699142, 3803398766, 1273315391, 11120289724, 925131455],
  ES_musica_regional_latina: [9003957462, 10629918582, 10630090322, 10630096622, 10630104822],
  GL_kpop: [4096400722, 12244134951, 7482846624],
  GL_reggae: [2448918882, 1295485847, 1503415633, 2042023484],
  GL_edm_dance: [687945565, 12134756071, 1495242491],
  GL_afrobeats_african: [12673058961, 1257036831, 1440933255],
  GL_metal: [1050179021, 8322139862, 7752014202],
  GL_soundtracks: [12729422541, 613860315, 1501014451],
  GL_jazz_lounge: [1311336155, 4040233102, 5898527324],
  GL_classical: [1330286435, 1263898441, 9240620582, 15259069123],
  GL_kids_family: [985417985, 515009671, 15208117963, 12637666591],
  GL_indian: [1078410111, 14566124722, 9169400442, 12637675591],
};

async function deezerFetch(path) {
  const url = `${DEEZER_API}${path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Deezer ${res.status}: ${url}`);
  return res.json();
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

const allData = [];

for (const [genre, playlistIds] of Object.entries(GENRE_PLAYLISTS)) {
  console.log(`\n[${genre}] ${playlistIds.length} playlists`);
  let tracks = [];
  const seen = new Set();

  for (const pid of playlistIds) {
    if (tracks.length >= TARGET_PER_GENRE) break;
    try {
      const data = await deezerFetch(`/playlist/${pid}/tracks?limit=100`);
      if (!data?.data) continue;
      for (const t of data.data) {
        if (!t.preview || seen.has(t.id)) continue;
        seen.add(t.id);
        tracks.push({
          name: t.title,
          artist: t.artist?.name || 'Unknown',
          genre: genre,
          deezer_genres: (t.album?.genres?.data || []).map(g => g.name),
          rank: t.rank || 0,
          deezer_id: t.id,
        });
      }
      console.log(`  Playlist ${pid}: +${data.data.length} tracks`);
    } catch (err) {
      console.error(`  Playlist ${pid}: ERROR ${err.message}`);
    }
    await sleep(50); // rate limit
  }

  tracks.sort((a, b) => b.rank - a.rank);
  tracks = tracks.slice(0, TARGET_PER_GENRE);
  console.log(`  Total: ${tracks.length} tracks for ${genre}`);
  allData.push(...tracks);
}

console.log(`\nTotal dataset: ${allData.length} tracks across ${Object.keys(GENRE_PLAYLISTS).length} genres`);

// Write JSONL
const lines = allData.map(t => JSON.stringify({ name: t.name, artist: t.artist, genre: t.genre }));
writeFileSync(OUTPUT_FILE, lines.join('\n') + '\n');
console.log(`Written to ${OUTPUT_FILE}`);

// Per-genre stats
const counts = {};
for (const t of allData) counts[t.genre] = (counts[t.genre] || 0) + 1;
for (const [g, c] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${g}: ${c}`);
}
