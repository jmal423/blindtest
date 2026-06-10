export const GENRES = [];

export const GENRES = [
  'pop', 'rock', 'hip-hop', 'r-n-b', 'electronic', 'jazz', 'classical',
  'country', 'metal', 'indie', 'soul', 'blues', 'reggae', 'latin',
  'dance', 'brazilian', 'portugal', 'french-pop', 'french-rap',
  'folk', 'african', 'arabic', 'asian', 'indian', 'soundtrack', 'k-pop',
  'children', 'funk', 'samba', 'mpb',
];

export function buildGenrePrompt(trackName, artist) {
  return `You are a music genre classifier. Given a song title and artist, respond with ONLY a JSON object.
Do NOT include any other text, explanation, or markdown formatting.

Rules:
- "genres": an array of 1-4 genres from this allowed list: ${GENRES.join(', ')}.
- "tags": an array of 3-8 free-form descriptive tags (mood, era, style, instrumentation, tempo). Examples: "upbeat", "melancholic", "electronic", "acoustic", "90s", "female-vocals", "dancefloor", "chill", "heavy", "minimal".
- "primary": the single best matching genre from the allowed list (as a string, not array).
- "confidence": an object mapping each genre to your confidence score (0.0 to 1.0). Be honest — use low scores for uncertain matches.

Respond with:
{"genres":[...], "tags":[...], "primary":"...", "confidence":{...}}

Track: "${trackName}"
Artist: "${artist}"`;
}
