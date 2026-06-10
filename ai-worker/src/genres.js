export const GENRES = [];

export function buildGenrePrompt(trackName, artist) {
  return `You are a music classifier. Given a song title and artist, respond with ONLY a JSON object.
Do NOT include any other text, explanation, or markdown formatting.

Rules:
- "genres": an array of 1-4 genre labels that best describe the music (be specific and creative).
- "tags": an array of 3-8 free-form descriptive tags (mood, era, style, instrumentation, tempo, cultural origin). Examples: "upbeat", "melancholic", "electronic", "acoustic", "90s", "female-vocals", "dancefloor", "chill", "heavy", "minimal", "french-rap".
- "primary": the single best matching genre label.
- "confidence": an object mapping each genre to your confidence score (0.0 to 1.0) based on how well the track matches that genre. Be honest — use low scores for uncertain matches.

Respond with:
{"genres":[...], "tags":[...], "primary":"...", "confidence":{...}}

Track: "${trackName}"
Artist: "${artist}"`;
}
