import crypto from 'node:crypto';

const POINTS_CORRECT = 100;
const POINTS_BONUS_PER_SECOND = 10;

function generateId() {
  return crypto.randomUUID();
}

function normalize(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\(feat\..*\)|\(ft\..*\)|\(remastered\)|\(.*?version\)/g, '')
    .trim();
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function isCorrectGuess(answer, trackName) {
  const a = normalize(answer);
  const t = normalize(trackName);
  if (!a || !t) return false;
  if (a === t) return true;
  if (a.includes(t) || t.includes(a)) return true;
  const dist = levenshtein(a, t);
  if (dist <= 2) return true;
  if (dist / Math.max(a.length, t.length) <= 0.25) return true;
  return false;
}

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export class GameRoom {
  constructor(code, genres) {
    this.code = code;
    this.genres = genres;
    this.settings = { rounds: 10, roundTime: 15, pauseTime: 4 };
    this.tracks = [];
    this.players = [];
    this.state = 'waiting';
    this.currentRound = 0;
    this.totalRounds = 0;
    this.roundStartTime = null;
    this.roundTimer = null;
    this.pauseTimer = null;
    this.roundResult = null;
    this.rankings = null;
    this.hostId = null;
    this.pauseStartTime = null;
  }

  getSettings() {
    return { ...this.settings };
  }

  updateSettings(updates) {
    if (updates.rounds) this.settings.rounds = Math.max(3, Math.min(25, Math.round(updates.rounds)));
    if (updates.roundTime) this.settings.roundTime = Math.max(8, Math.min(30, Math.round(updates.roundTime)));
    if (updates.pauseTime !== undefined) this.settings.pauseTime = Math.max(2, Math.min(15, Math.round(updates.pauseTime)));
  }

  addPlayer(name) {
    const id = generateId();
    this.players.push({ id, name, score: 0, answers: [] });
    if (!this.hostId) this.hostId = id;
    return id;
  }

  getPlayer(id) {
    return this.players.find(p => p.id === id);
  }

  async startGame() {
    if (this.players.length === 0) return;
    if (this.state !== 'waiting') return;

    const { getTracksByGenre } = await import('./spotify.js');

    const allTracks = [];
    for (const genre of this.genres) {
      try {
        const tracks = await getTracksByGenre(genre, this.settings.rounds);
        allTracks.push(...tracks);
      } catch (err) {
        console.error(`Failed to fetch tracks for genre "${genre}":`, err.message);
      }
    }

    this.tracks = shuffle(allTracks).slice(0, this.settings.rounds);
    this.totalRounds = this.tracks.length;

    if (this.tracks.length === 0) return 'No tracks found';

    this.players.forEach(p => { p.score = 0; p.answers = []; });
    this.currentRound = 0;
    this.startRound();
    return null;
  }

  async startRound() {
    if (this.currentRound >= this.tracks.length) {
      this.endGame();
      return;
    }

    const track = this.tracks[this.currentRound];
    if (!track.youtubeVideoId) {
      const { searchYouTubeVideo } = await import('./youtube.js');
      track.youtubeVideoId = await searchYouTubeVideo(track.name, track.artist);
    }

    const nextTrack = this.tracks[this.currentRound + 1];
    if (nextTrack && !nextTrack.youtubeVideoId) {
      const { searchYouTubeVideo } = await import('./youtube.js');
      searchYouTubeVideo(nextTrack.name, nextTrack.artist)
        .then(id => { nextTrack.youtubeVideoId = id; })
        .catch(() => {});
    }

    this.roundStartTime = Date.now();
    this.state = 'playing';
    this.roundResult = null;

    this.roundTimer = setTimeout(() => {
      this.endRound();
    }, (this.settings.roundTime + 3) * 1000);
  }

  submitAnswer(playerId, answer) {
    const player = this.getPlayer(playerId);
    if (!player || this.state !== 'playing') return;

    const track = this.tracks[this.currentRound];
    if (!track) return;

    const guessTimeMs = Date.now() - this.roundStartTime;
    const isCorrect = isCorrectGuess(answer, track.name);
    let points = 0;

    if (isCorrect) {
      const elapsed = guessTimeMs / 1000;
      const timeBonus = Math.max(0, Math.floor((this.settings.roundTime - elapsed) * POINTS_BONUS_PER_SECOND));
      points = POINTS_CORRECT + timeBonus;
    }

    player.score += points;
    player.answers.push({
      round: this.currentRound,
      answer,
      correct: isCorrect,
      points,
    });

    return { correct: isCorrect, points, correctAnswer: track.name, artist: track.artist, guessTimeMs, trackId: track.id, genre: track.genre };
  }

  endRound() {
    if (this.roundTimer) { clearTimeout(this.roundTimer); this.roundTimer = null; }

    const track = this.tracks[this.currentRound];
    this.state = 'round_result';
    this.roundResult = {
      round: this.currentRound + 1,
      correctAnswer: track.name,
      artist: track.artist,
      albumImage: track.albumImage,
    };

    this.pauseStartTime = Date.now();
    this.pauseTimer = setTimeout(() => {
      this.currentRound++;
      if (this.currentRound >= this.tracks.length) {
        this.endGame();
      } else {
        this.startRound();
      }
    }, this.settings.pauseTime * 1000);
  }

  endGame() {
    if (this.roundTimer) { clearTimeout(this.roundTimer); this.roundTimer = null; }
    if (this.pauseTimer) { clearTimeout(this.pauseTimer); this.pauseTimer = null; }

    this.state = 'finished';
    this.rankings = [...this.players].sort((a, b) => b.score - a.score)
      .map((p, i) => ({ rank: i + 1, name: p.name, score: p.score, answers: p.answers }));
  }

  getState() {
    const base = {
      state: this.state,
      settings: this.getSettings(),
      genres: this.genres,
      players: this.players.map(p => ({ id: p.id, name: p.name, score: p.score })),
      currentRound: this.currentRound + 1,
      totalRounds: this.totalRounds,
    };

    if (this.state === 'playing') {
      const elapsed = (Date.now() - this.roundStartTime) / 1000;
      const timeLeft = Math.max(0, Math.ceil(this.settings.roundTime - elapsed));
      const track = this.tracks[this.currentRound];
      return {
        ...base,
        timeLeft,
        roundTime: this.settings.roundTime,
        youtubeVideoId: track.youtubeVideoId,
        trackId: track.id,
      };
    }

    if (this.state === 'round_result') {
      const pauseElapsed = this.pauseStartTime ? (Date.now() - this.pauseStartTime) / 1000 : 0;
      const pauseTimeLeft = Math.max(0, Math.ceil(this.settings.pauseTime - pauseElapsed));
      return { ...base, roundResult: this.roundResult, pauseTimeLeft };
    }

    if (this.state === 'finished') {
      return { ...base, rankings: this.rankings };
    }

    return base;
  }

  destroy() {
    if (this.roundTimer) clearTimeout(this.roundTimer);
    if (this.pauseTimer) clearTimeout(this.pauseTimer);
    this.players = [];
    this.tracks = [];
  }
}
