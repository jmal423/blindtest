import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const GENRES = [
  // Português
  "fado",
  "tradicional_folklore_pimba",
  "pop_tuga",
  "pop_rock_tuga",
  "hip_hop_tuga",
  "classica_tuga",
  "kizomba_palop",
  "pop_urbano_nova_pop",

  // Brasileiro
  "samba_pagode",
  "bossa_nova",
  "funk_brasileiro",

  // Inglês US
  "pop_us",
  "hip_hop_trap_us",
  "country_americana_us",
  "rock_alternative_us",

  // Inglês UK
  "pop_uk",
  "uk_drill_grime",
  "britpop_rock_uk",
  "uk_garage_dnb",

  // Francês
  "chanson_francaise",
  "pop_francaise",
  "rap_francais",
  "french_touch_electro",

  // Espanhol
  "flamenco",
  "reggaeton_urbano",
  "musica_regional_latina",

  // Mundo & Outros
  "other"
];

const GENRE_GROUPS = [
  {
    "id": "portuguese",
    "genreIds": [
      "fado",
      "tradicional_folklore_pimba",
      "pop_tuga",
      "pop_rock_tuga",
      "hip_hop_tuga",
      "classica_tuga",
      "kizomba_palop",
      "pop_urbano_nova_pop"
    ]
  },
  {
    "id": "brazilian",
    "genreIds": [
      "samba_pagode",
      "bossa_nova",
      "funk_brasileiro"
    ]
  },
  {
    "id": "united_states",
    "genreIds": [
      "pop_us",
      "hip_hop_trap_us",
      "country_americana_us",
      "rock_alternative_us"
    ]
  },
  {
    "id": "united_kingdom",
    "genreIds": [
      "pop_uk",
      "uk_drill_grime",
      "britpop_rock_uk",
      "uk_garage_dnb"
    ]
  },
  {
    "id": "french",
    "genreIds": [
      "chanson_francaise",
      "pop_francaise",
      "rap_francais",
      "french_touch_electro"
    ]
  },
  {
    "id": "spanish",
    "genreIds": [
      "flamenco",
      "reggaeton_urbano",
      "musica_regional_latina"
    ]
  },
  {
    "id": "global_other",
    "genreIds": [
      "other"
    ]
  }
];

function main() {
  let configCode = `// Standardised Genres aligned with the strict AI Taxonomy\n`;
  configCode += `export const GENRES = ${JSON.stringify(GENRES, null, 2)};\n\n`;
  configCode += `export const GENRE_GROUPS = ${JSON.stringify(GENRE_GROUPS, null, 2)};\n`;

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
