export const GENRES = [];

export function buildGenrePrompt(trackName, artist) {
  return `You are a music classifier. Given a song title and artist, respond with ONLY a JSON object.
Do NOT include any other text, explanation, or markdown formatting.

Rules:
- "genres": an array of 1-4 genre labels describing the music (be specific: "french-rap", "k-pop", "synthwave", "trap", "drill", etc).
- "tags": an array of 3-8 free-form descriptive tags (mood, era, style, instrumentation, tempo). Examples: "upbeat", "melancholic", "electronic", "acoustic", "90s", "female-vocals", "dancefloor", "chill", "heavy", "minimal".
- "primary": the single best matching genre label (as a string, not array).
- "confidence": an object mapping each genre to your confidence score (0.0 to 1.0). Be honest — use low scores for uncertain matches.

Respond with:
{"genres":[...], "tags":[...], "primary":"...", "confidence":{...}}

Track: "${trackName}"
Artist: "${artist}"`;
}
