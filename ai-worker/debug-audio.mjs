import pg from 'pg';
const p = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });

const r = await p.query("SELECT COUNT(*)::int as total, COUNT(*) FILTER (WHERE preview_url IS NOT NULL)::int as has_preview, COUNT(*) FILTER (WHERE preview_url IS NULL)::int as no_preview FROM songs_cache WHERE ai_genres->>0 = 'UNCLASSIFIED'");
console.log('UNCLASSIFIED preview stats:', r.rows[0]);

const sample = await p.query("SELECT name, artist, LEFT(preview_url, 80) as preview_url FROM songs_cache WHERE ai_genres->>0 = 'UNCLASSIFIED' AND preview_url IS NOT NULL LIMIT 3");
console.log('Sample preview URLs:', JSON.stringify(sample.rows, null, 2));

await p.end();
