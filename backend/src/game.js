import crypto from 'node:crypto';

const POINTS_CORRECT = 100;
const POINTS_BONUS_PER_SECOND = 10;

function generateId() {
  return crypto.randomUUID();
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
  }

  getSettings() {
    return { ...this.settings };
  }

  updateSettings(updates) {
    if (updates.rounds) this.settings.rounds = Math.max(3, Math.min(25, Math.round(updates.rounds)));
    if (updates.roundTime) this.settings.roundTime = Math.max(8, Math.min(30, Math.round(updates.roundTime)));
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
    }, this.settings.roundTime * 1000);
  }

  submitAnswer(playerId, answer) {
    const player = this.getPlayer(playerId);
    if (!player || this.state !== 'playing') return;

    const track = this.tracks[this.currentRound];
    if (!track) return;

    const isCorrect = answer.toLowerCase().trim() === track.name.toLowerCase().trim();
    let points = 0;

    if (isCorrect) {
      const elapsed = (Date.now() - this.roundStartTime) / 1000;
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

    return { correct: isCorrect, points, correctAnswer: track.name, artist: track.artist };
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
        youtubeVideoId: track.youtubeVideoId,
        trackId: track.id,
      };
    }

    if (this.state === 'round_result') {
      return { ...base, roundResult: this.roundResult };
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
