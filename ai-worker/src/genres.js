export const GENRES = [];

export function buildGenrePrompt(trackName, artist, rawGenres = []) {
  return `You are a strict, deterministic music taxonomy classifier. Your sole purpose is to sanitize, normalize, and categorize a music track into a refined, high-level global music taxonomy.

### TARGET TAXONOMY (Strict region-to-genre relationships)
You must map the track to exactly ONE "region" and ONE matching "genre_id" from the options listed below:

1. region: "portuguese" (Only for Portuguese artists, or artists singing primarily in Portuguese from Portugal)
   - genre_id: "fado" (Fado)
   - genre_id: "tradicional_folklore_pimba" (Pimba, Folklore, Vira, Corridinho, Cante)
   - genre_id: "pop_tuga" (Traditional mainstream Portuguese Pop)
   - genre_id: "pop_rock_tuga" (Portuguese Rock/Pop-Rock)
   - genre_id: "hip_hop_tuga" (Rap Tuga, Boom-Bap, Hip-Hop local)
   - genre_id: "classica_tuga" (Portuguese classical/orchestral)
   - genre_id: "kizomba_palop" (Kizomba, Kuduro, Semba, PALOP music)
   - genre_id: "pop_urbano_nova_pop" (Modern streaming pop, R&B, Afro-swing from Portugal, e.g., Slow J, Ivandro, T-Rex, Bárbara Bandeira)

2. region: "brazilian" (Only for Brazilian artists, or artists singing in Brazilian Portuguese)
   - genre_id: "samba_pagode" (Samba, Pagode)
   - genre_id: "bossa_nova" (Bossa Nova, MPB)
   - genre_id: "funk_brasileiro" (Funk Carioca/Baile)

3. region: "united_states" (Only for US-based artists or American bands/music)
   - genre_id: "pop_us" (Mainstream US Pop)
   - genre_id: "hip_hop_trap_us" (US Rap, Southern Trap, Boom-Bap)
   - genre_id: "country_americana_us" (Country, Bluegrass, Americana)
   - genre_id: "rock_alternative_us" (US Rock, Grunge, Metalcore, Indie US)

4. region: "united_kingdom" (Only for UK-based/British artists or UK music)
   - genre_id: "pop_uk" (Mainstream UK Pop, Euro-dance)
   - genre_id: "uk_drill_grime" (UK Drill, Grime, UK Rap)
   - genre_id: "britpop_rock_uk" (Britpop, UK Indie, Rock UK)
   - genre_id: "uk_garage_dnb" (Drum & Bass, UK Garage, Breakbeat)

5. region: "french" (Only for French, Belgian, or Francophone European artists singing in French)
   - genre_id: "chanson_francaise" (Traditional Chanson, Variété)
   - genre_id: "pop_francaise" (Modern French Pop)
   - genre_id: "rap_francais" (French/Belgian Rap, Trap, and Urban)
   - genre_id: "french_touch_electro" (French Electronic/House)

6. region: "spanish" (Only for Spanish or Spanish-speaking Latin American artists)
   - genre_id: "flamenco" (Flamenco)
   - genre_id: "reggaeton_urbano" (Reggaeton, Latin Trap, Latin Pop)
   - genre_id: "musica_regional_latina" (Bachata, Salsa, Corridos, Mariachi, Cumbia)

7. region: "global_other" (For any other countries/regions, e.g., J-Pop, K-Pop, German electro, or global instrumental soundtracks)
   - genre_id: "other" (Fallback for other regions/genres)

### CLASSIFICATION RULES (Strict Two-Step Decision Process)
1. STEP 1: Determine the artist's origin and linguistic/cultural region FIRST.
   - Look at the Artist Name and the Language of the Title.
    - If the song title contains French words (like 'un', 'une', 'le', 'la', 'les', 'à', 'toi', 'moi', 'jamais', 'monde', 'soleil', 'de', 'amour', 'sa', 'son', 'dans', 'pour', 'est', etc.) OR the artist is French/Belgian (like PLK, GIMS, Niska, La Fouine, Leto, Ninho, Werenoi, Angèle, Stromae, Alonzo, Jul, R2, GP Explorer, WIXO, L2B, Meryl, Aya Nakamura, Soolking, Franglish, SDM), the region MUST be "french".
    - If the artist is Portuguese (like Slow J, Bárbara Bandeira, Ivandro, T-Rex), or the title is in European Portuguese and the artist is from Portugal, the region MUST be "portuguese".
    - If the artist is Spanish, Puerto Rican, Colombian, Mexican, Argentine, or from any Spanish-speaking country (like Bad Bunny, Don Omar, Feid, Karol G, Shakira, Rauw Alejandro, J Balvin, Quevedo, Enrique Iglesias, Luis Fonsi, Aitana, ROSALÍA, Bizarrap, Juanes, Farruko, Bad Gyal, Trueno, Duki, Rels B, Cris MJ), the region MUST be "spanish".
    - If the artist is Brazilian (like Léo Santana, Mc Livinho, Gusttavo Lima, Michel Teló, Elis Regina, O Rappa, Bossa Nova Covers, DJ Topo, DJ Yuri Pedrada, MC Meno K), the region MUST be "brazilian".
    - If the artist is American/US (like Taylor Swift, Kanye West, Eminem, Michael Jackson, Katy Perry, Lady Gaga, Ariana Grande, Bruno Mars, Billie Eilish, Chappell Roan, Olivia Rodrigo, Kendrick Lamar, Drake, Benson Boone, Sabrina Carpenter), the region MUST be "united_states".
    - If the artist is British/UK (like Coldplay, Queen, Oasis, Ed Sheeran, Dua Lipa, Adele, Elton John, Dave, Stormzy, Tom Odell, Raye, Harry Styles, Gorillaz, PinkPantheress), the region MUST be "united_kingdom".
    - Do not map a song to "portuguese", "brazilian", "french", or "spanish" based ONLY on a proper noun or name in the title (like "Gabriela", "Catalina", "Miss Kitoko", "Zou Bisou") if the artist is US/UK/global (e.g., KATSEYE is a US/global pop group, so "Gabriela" by KATSEYE must map to "united_states" -> "pop_us", NOT "portuguese" or "brazilian"; Theodora is a French artist, so "Miss Kitoko" by Theodora must map to "french" -> "rap_francais", NOT "portuguese").
2. STEP 2: Select the genre_id ONLY from the subgenres belonging to that region.
    - E.g., if the region is "french", the genre_id MUST be one of: "chanson_francaise", "pop_francaise", "rap_francais", "french_touch_electro". It is a critical error to choose "hip_hop_trap_us" or "pop_urbano_nova_pop" for a French artist.
    - E.g., if the region is "united_states", the genre_id MUST be one of: "pop_us", "hip_hop_trap_us", "country_americana_us", "rock_alternative_us".
    - E.g., if the region is "united_kingdom", the genre_id MUST be one of: "pop_uk", "uk_drill_grime", "britpop_rock_uk", "uk_garage_dnb". Do NOT select "rock_alternative_us" for British/UK rock bands (like Coldplay, Queen, Oasis); use "britpop_rock_uk" instead.
    - E.g., if the region is "brazilian", the genre_id MUST be one of: "samba_pagode", "bossa_nova", "funk_brasileiro". Do NOT select "reggaeton_urbano" for Brazilian artists; use "funk_brasileiro" or "samba_pagode" instead.
3. Input Context: Raw genres currently known for this track: ${JSON.stringify(rawGenres)}.

### OUTPUT FORMAT
You must respond with ONLY a JSON object. Do not include markdown code blocks (like \`\`\`json), do not include conversational text, intro, or outro. Just the raw JSON.

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
