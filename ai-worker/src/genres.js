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

2. region: "brazilian" (Strictly for Brazilian artists, NO MATTER what language they sing)
   - genre_id: "samba_pagode" (Samba, Pagode)
   - genre_id: "bossa_nova" (Bossa Nova, MPB, classic acoustic melodies)
   - genre_id: "funk_brasileiro" (Funk Carioca, Baile Funk, Funk Ostentação, tracks by Mc Livinho, MC Kevinho, DJ Bruninho 17)

3. region: "united_states" (Only for US-based artists, historical legends or American bands)
   - genre_id: "pop_us" (Mainstream US Pop, including both legacy icons like Michael Jackson and modern artists like Taylor Swift)
   - genre_id: "hip_hop_trap_us" (US Rap, Southern Trap, Boom-Bap, Eminem)
   - genre_id: "country_americana_us" (Country, Bluegrass, Americana)
   - genre_id: "rock_alternative_us" (US Rock, Classic Rock, Grunge, Metalcore, Indie US)

4. region: "united_kingdom" (Strictly for UK-based/British artists, bands, and legacy rock legends)
   - genre_id: "pop_uk" (Mainstream UK Pop, Euro-dance, Adele, Ed Sheeran, Dua Lipa)
   - genre_id: "uk_drill_grime" (UK Drill, Grime, UK Rap)
   - genre_id: "britpop_rock_uk" (Britpop, UK Indie, Classic/Stadium Rock UK, Oasis, Coldplay, Queen)
   - genre_id: "uk_garage_dnb" (Drum & Bass, UK Garage, Breakbeat)

5. region: "french" (Only for French, Belgian, or Francophone European artists singing in French, or French soundtrack tracks)
   - genre_id: "chanson_francaise" (Traditional Chanson, Variété)
   - genre_id: "pop_francaise" (Modern French Pop, Aya Nakamura pop tracks, French soundtrack pop)
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

### CLASSIFICATION DECISION TREE (Follow step-by-step from top to bottom)

#### STEP 1: METADATA RULE-BASED ENFORCEMENT (Highest Priority)
- If the array of raw genres ${JSON.stringify(rawGenres)} contains "funk-brasileiro", you MUST immediately classify the track as region: "brazilian" and genre_id: "funk_brasileiro".
- If the array of raw genres ${JSON.stringify(rawGenres)} contains "musique-asiatique" or "kpop", you MUST immediately classify the track as region: "global_other" and genre_id: "kpop".
- If the array of raw genres ${JSON.stringify(rawGenres)} contains "fado" or "fado-portuguese", you MUST immediately classify the track as region: "portuguese" and genre_id: "fado".
- If the array of raw genres ${JSON.stringify(rawGenres)} contains "chanson-française" or "chanson-francaise", you MUST immediately classify the track as region: "french" and genre_id: "chanson_francaise".

#### STEP 2: LEGENDARY ARTIST OVERRIDE DIRECTIVES (Second Priority - Forces BOTH Region and Genre)
- If the artist is "Michael Jackson", you MUST map to region: "united_states" and genre_id: "pop_us".
- If the artist is "Oasis" or "Coldplay" or "Queen", you MUST map to region: "united_kingdom" and genre_id: "britpop_rock_uk".
- If the artist is "Adele", you MUST map to region: "united_kingdom" and genre_id: "pop_uk".
- If the artist is "Mc Livinho" or "DJ BRUNINHO 17", you MUST map to region: "brazilian" and genre_id: "funk_brasileiro".
- If the artist is "BLACKPINK" or "BTS" or "JENNIE", you MUST map to region: "global_other" and genre_id: "kpop".
- If the artist is "Anitta": region MUST be "brazilian". If track is "Funk Rave" or tags contain funk, genre_id is "funk_brasileiro". If track is "Downtown" or "Choka Choka", map to genre_id: "reggaeton_urbano" (exception for her global urban collabs).
- If the artist is or contains "Xutos & Pontapés", "Xutos e Pontapés", "GNR", "Rui Veloso", "UHF", "Ornatos Violeta", "Quinta do Bill", "Delfins", "The Gift", "Silence 4", "Jorge Palma", "Clã", "Amor Electro", "Sétima Legião", "Tara Perdida", "Mão Morta", "Capitão Fausto", "Linda Martini", "Taxi", "Peste & Sida", "Heróis do Mar", you MUST map to region: "portuguese" and genre_id: "pop_rock_tuga".
- If the artist is or contains "Pitty", "Skank", "Raimundos", "Ira!", "RPM", "Engenheiros do Hawaii", "Legião Urbana", "Paralamas do Sucesso", "Barão Vermelho", "Titãs", "Charlie Brown Jr.", "Capital Inicial", "O Rappa", "Detonautas", "Mamonas Assassinas", "CPM 22", "Fresno", "Nx Zero", "Sepultura", "Angra", "Jota Quest", "Los Hermanos", you MUST map to region: "global_other" and genre_id: "other" (because they are Brazilian rock/metal/alternative bands and do not fit samba, bossa nova, or funk).
- If the artist is or contains "Caetano Veloso", "Gilberto Gil", "Chico Buarque", "Djavan", "Elis Regina", "Gal Costa", "Maria Bethânia", "Marisa Monte", "Seu Jorge", "Rita Lee", "Cazuza", "Lulu Santos", "Kid Abelha", you MUST map to region: "brazilian" and genre_id: "bossa_nova" (as they represent classic MPB/Bossa Nova).
- If the artist is or contains "Tony Carreira", "Toy", "Quim Barreiros", "Emanuel", "Ágata", "Ruth Marlene", "Bandanda", "José Malhoa", you MUST map to region: "portuguese" and genre_id: "tradicional_folklore_pimba".
- If the artist is or contains "Slow J", "Ivandro", "T-Rex", "Bárbara Bandeira", "Bárbara Tinoco", "Carolina Deslandes", "D.A.M.A", "Diogo Piçarra", "Fernando Daniel", "Matias Damásio", "Syro", "Nininho Vaz Maia", you MUST map to region: "portuguese" and genre_id: "pop_urbano_nova_pop".

#### STEP 3: LINGUISTIC TITLE ANALYSIS (Third Priority)
- If the song title contains French words (e.g., "Seuls au monde", "L'assasymphonie", "J'ai vu", "Tu dors ?"), you MUST classify the region as "french". If the artist is a franchise (like "Miraculous"), map to genre_id: "pop_francaise".

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
