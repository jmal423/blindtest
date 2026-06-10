export default {
  name: '008_already_verified',
  up: `
    ALTER TABLE songs_cache ADD COLUMN IF NOT EXISTS already_verified BOOLEAN DEFAULT FALSE;
  `,
};
