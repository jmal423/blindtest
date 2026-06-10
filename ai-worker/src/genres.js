export const GENRES = [
  "fado", "tradicional_folklore_pimba", "pop_tuga", "pop_rock_tuga", "hip_hop_tuga", "classica_tuga", "kizomba_palop", "pop_urbano_nova_pop",
  "samba_pagode", "bossa_nova", "funk_brasileiro",
  "pop_us", "hip_hop_trap_us", "country_americana_us", "rock_alternative_us",
  "pop_uk", "uk_drill_grime", "britpop_rock_uk", "uk_garage_dnb",
  "chanson_francaise", "pop_francaise", "rap_francais", "french_touch_electro",
  "flamenco", "reggaeton_urbano", "musica_regional_latina",
  "reggae", "kpop", "other"
];

export function buildGenrePrompt(trackName, artist, rawGenres = []) {
  return `You are a strict, deterministic music taxonomy classifier. Your sole purpose is to sanitize, normalize, and categorize a music track into a refined, high-level global music taxonomy.

### TARGET TAXONOMY (Strict region-to-genre relationships)
You must map the track to exactly ONE "region" and ONE matching "genre_id" from the options listed below:

1. region: "portuguese" (Only for Portuguese artists from Portugal)
   - genre_id: "fado" (Fado)
   - genre_id: "tradicional_folklore_pimba" (Pimba, Folklore, Vira, Corridinho, Cante)
   - genre_id: "pop_tuga" (Traditional mainstream Portuguese Pop)
   - genre_id: "pop_rock_tuga" (Portuguese Rock/Pop-Rock)
   - genre_id: "hip_hop_tuga" (Rap Tuga, Boom-Bap, Hip-Hop local)
   - genre_id: "classica_tuga" (Portuguese classical/orchestral)
   - genre_id: "kizomba_palop" (Kizomba, Kuduro, Semba, PALOP music)
   - genre_id: "pop_urbano_nova_pop" (Modern streaming pop, R&B, Afro-swing from Portugal, e.g., Slow J, Ivandro, T-Rex, Bárbara Bandeira)

2. region: "brazilian" (Strictly for Brazilian artists, NO MATTER what language they sing or what raw tags say)
   - genre_id: "samba_pagode" (Samba, Pagode)
   - genre_id: "bossa_nova" (Bossa Nova, MPB)
   - genre_id: "funk_brasileiro" (Funk Carioca, Baile Funk, Funk Ostentação, ALL tracks by Mc Livinho, MC Kevinho, Anitta's Funk/Pop tracks)

3. region: "united_states" (Only for US-based artists or American bands)
   - genre_id: "pop_us" (Mainstream US Pop)
   - genre_id: "hip_hop_trap_us" (US Rap, Southern Trap, Boom-Bap)
   - genre_id: "country_americana_us" (Country, Bluegrass, Americana)
   - genre_id: "rock_alternative_us" (US Rock, Grunge, Metalcore, Indie US)

4. region: "united_kingdom" (Strictly for UK-based/British artists, e.g., Coldplay, Oasis, Queen, Adele, Ed Sheeran, Dua Lipa)
   - genre_id: "pop_uk" (Mainstream UK Pop, Euro-dance, Adele)
   - genre_id: "uk_drill_grime" (UK Drill, Grime, UK Rap)
   - genre_id: "britpop_rock_uk" (Britpop, UK Indie, Rock UK, Oasis, Coldplay, Queen)
   - genre_id: "uk_garage_dnb" (Drum & Bass, UK Garage, Breakbeat)

5. region: "french" (Only for French, Belgian, or Francophone European artists singing in French)
   - genre_id: "chanson_francaise" (Traditional Chanson, Variété)
   - genre_id: "pop_francaise" (Modern French Pop, Aya Nakamura pop tracks)
   - genre_id: "rap_francais" (French/Belgian Rap, Trap, and Urban, GIMS, PLK, Vacra)
   - genre_id: "french_touch_electro" (French Electronic/House)

6. region: "spanish" (For Spanish-speaking artists from Spain and Latin America, e.g., Rosalía, Bad Bunny, Karol G, Shakira)
   - genre_id: "flamenco" (Flamenco)
   - genre_id: "reggaeton_urbano" (Reggaeton, Latin Trap, Latin Pop)
   - genre_id: "musica_regional_latina" (Bachata, Salsa, Corridos, Mariachi, Cumbia)

7. region: "global_other" (For specific global movements)
   - genre_id: "reggae" (Reggae, Jamaican artists like Bob Marley)
   - genre_id: "kpop" (Korean Pop, strictly for artists like BTS, BLACKPINK, Jennie, NewJeans, Stray Kids)
   - genre_id: "other" (Fallback for other unlisted regions)

### CLASSIFICATION RULES (Strict Enforcement)
1. ARTIST OVERRIDE DIRECTIVES (Mandatory):
   - If the artist is "Anitta", the region MUST be "brazilian". If the track name is "Funk Rave" or "Downtown" or raw tags indicate urban/pop beats, map to genre_id: "funk_brasileiro". Never map Anitta to "portuguese" or "spanish" regions.
   - If the artist is "Mc Livinho", the region MUST be "brazilian" and genre_id MUST be "funk_brasileiro". Ignore any raw tags saying "bossa-nova".
   - If the artist is "BLACKPINK", "BTS", or "JENNIE", the region MUST be "global_other" and genre_id MUST be "kpop". Never fallback to "other" or "reggae" for these artists.
2. TEXTUAL PRIORITY: Ignore corrupted raw genres if they contradict the known musical identity of the global artist provided.
3. Input Context: Raw genres currently known for this track: ${JSON.stringify(rawGenres)}.

### OUTPUT FORMAT
You must respond with ONLY a JSON object. Do not include markdown code blocks, conversational text, intro, or outro.

Output Schema:
{
  "title": "${trackName.replace(/"/g, '\\"')}",
  "artist": "${artist.replace(/"/g, '\\"')}",
  "mapped_region": "region_id_here",
  "mapped_genre_id": "genre_id_here"
}

Track Title: "${trackName}"
Artist Name: "${artist}"`;
}
