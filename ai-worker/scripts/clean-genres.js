import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const GENRES = [
  // Português
  "PT_fado",
  "PT_tradicional_folklore_pimba",
  "PT_pop_tuga",
  "PT_pop_rock_tuga",
  "PT_hip_hop_tuga",
  "PT_classica_tuga",
  "PT_kizomba_palop",
  "PT_pop_urbano_nova_pop",

  // Brasileiro
  "BR_samba_pagode",
  "BR_bossa_nova",
  "BR_funk_brasileiro",
  "BR_pop_rock_brasileiro",
  "BR_pop",

  // Inglês US
  "US_pop_us",
  "US_hip_hop_trap_us",
  "US_country_americana_us",
  "US_rock_alternative_us",

  // Inglês UK
  "UK_pop_uk",
  "UK_uk_drill_grime",
  "UK_britpop_rock_uk",
  "UK_uk_garage_dnb",

  // Francês
  "FR_chanson_francaise",
  "FR_pop_francaise",
  "FR_rap_francais",
  "FR_french_touch_electro",

  // Espanhol
  "ES_flamenco",
  "ES_reggaeton_urbano",
  "ES_musica_regional_latina",

  // Mundo & Outros
  "GL_reggae",
  "GL_kpop",
  "GL_edm_dance",
  "GL_afrobeats_african",
  "GL_metal",
  "GL_soundtracks",
  "GL_jazz_lounge",
  "GL_other"
];

const GENRE_GROUPS = [
  {
    "id": "portuguese",
    "genreIds": [
      "PT_fado",
      "PT_tradicional_folklore_pimba",
      "PT_pop_tuga",
      "PT_pop_rock_tuga",
      "PT_hip_hop_tuga",
      "PT_classica_tuga",
      "PT_kizomba_palop",
      "PT_pop_urbano_nova_pop"
    ]
  },
  {
    "id": "brazilian",
    "genreIds": [
      "BR_samba_pagode",
      "BR_bossa_nova",
      "BR_funk_brasileiro",
      "BR_pop_rock_brasileiro",
      "BR_pop"
    ]
  },
  {
    "id": "united_states",
    "genreIds": [
      "US_pop_us",
      "US_hip_hop_trap_us",
      "US_country_americana_us",
      "US_rock_alternative_us"
    ]
  },
  {
    "id": "united_kingdom",
    "genreIds": [
      "UK_pop_uk",
      "UK_uk_drill_grime",
      "UK_britpop_rock_uk",
      "UK_uk_garage_dnb"
    ]
  },
  {
    "id": "french",
    "genreIds": [
      "FR_chanson_francaise",
      "FR_pop_francaise",
      "FR_rap_francais",
      "FR_french_touch_electro"
    ]
  },
  {
    "id": "spanish",
    "genreIds": [
      "ES_flamenco",
      "ES_reggaeton_urbano",
      "ES_musica_regional_latina"
    ]
  },
  {
    "id": "global_other",
    "genreIds": [
      "GL_reggae",
      "GL_kpop",
      "GL_edm_dance",
      "GL_afrobeats_african",
      "GL_metal",
      "GL_soundtracks",
      "GL_jazz_lounge",
      "GL_other"
    ]
  }
];

function main() {
  const configCode = `// Standardised Genres aligned with the strict AI Taxonomy
export const GENRES = ${JSON.stringify(GENRES, null, 2)};

export const GENRE_GROUPS = ${JSON.stringify(GENRE_GROUPS, null, 2)};
`;

  const outputDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }

  fs.writeFileSync(path.join(outputDir, 'genres-config.js'), configCode);
  console.log(`[File] Saved local configuration to scripts/output/genres-config.js`);

  const backendConfigPath = path.join(__dirname, '../../backend/src/genres-config.js');
  fs.writeFileSync(backendConfigPath, configCode);
  console.log(`[File] Saved backend configuration to backend/src/genres-config.js`);
}

main();
