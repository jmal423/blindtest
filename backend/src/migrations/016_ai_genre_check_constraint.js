export default {
  name: '016_ai_genre_check_constraint',
  up: `
    ALTER TABLE songs_cache DROP CONSTRAINT IF EXISTS ai_genre_valid;
    ALTER TABLE songs_cache
    ADD CONSTRAINT ai_genre_valid
    CHECK (
      ai_genres IS NULL
      OR ai_genres = '[]'::jsonb
      OR ai_genres->>0 IS NULL
      OR ai_genres->>0 IN (
        'UNCLASSIFIED',
        'PT_fado', 'PT_tradicional_folklore_pimba', 'PT_pop_tuga', 'PT_pop_rock_tuga',
        'PT_hip_hop_tuga', 'PT_classica_tuga', 'PT_kizomba_palop', 'PT_pop_urbano_nova_pop',
        'BR_samba_pagode', 'BR_bossa_nova', 'BR_funk_brasileiro', 'BR_pop_rock_brasileiro',
        'BR_pop',
        'US_pop_us', 'US_hip_hop_trap_us', 'US_country_americana_us', 'US_rock_alternative_us',
        'UK_pop_uk', 'UK_uk_drill_grime', 'UK_britpop_rock_uk', 'UK_uk_garage_dnb',
        'FR_chanson_francaise', 'FR_pop_francaise', 'FR_rap_francais', 'FR_french_touch_electro',
        'ES_flamenco', 'ES_reggaeton_urbano', 'ES_musica_regional_latina',
        'GL_reggae', 'GL_kpop', 'GL_edm_dance', 'GL_afrobeats_african',
        'GL_metal', 'GL_soundtracks', 'GL_jazz_lounge', 'GL_other'
      )
    );
  `,
};
