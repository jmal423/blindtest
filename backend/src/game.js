import crypto from 'node:crypto';

function generateId() {
  return crypto.randomUUID();
}

function normalizeString(str) {
  return str
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
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

function evaluateAnswer(guess, target) {
  const a = normalizeString(guess);
  const t = normalizeString(target);
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
  constructor(code, genres, io) {
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
    this.countdownTimer = null;
    this.pauseTimer = null;
    this.audioOffset = 0;
    this.roundResult = null;
    this.rankings = null;
    this.hostId = null;
    this.pauseStartTime = null;
    this.io = io;
    this.playerSockets = {};
  }

  setPlayerSocket(playerId, socketId) {
    this.playerSockets[playerId] = socketId;
  }

  broadcast() {
    if (this.io) {
      this.io.to(this.code).emit('game_state', this.getState());
    }
  }

  getSettings() {
    return { ...this.settings };
  }

  updateSettings(updates) {
    if (updates.rounds) this.settings.rounds = Math.max(3, Math.min(25, Math.round(updates.rounds)));
    if (updates.roundTime) this.settings.roundTime = Math.max(8, Math.min(30, Math.round(updates.roundTime)));
    if (updates.pauseTime !== undefined) this.settings.pauseTime = Math.max(2, Math.min(15, Math.round(updates.pauseTime)));
  }

  addPlayer(name, avatarUrl = null, role = 'user') {
    const id = generateId();
    this.players.push({ id, name, avatarUrl, role, score: 0, answers: [] });
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

    this.players.forEach(p => { p.score = 0; p.answers = []; p.streak = 0; });
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

    this.foundOrder = [];
    this.players.forEach(p => {
      p.foundArtist = false;
      p.foundTitle = false;
      p.foundBoth = false;
    });
    const maxOffset = Math.max(0, 30 - this.settings.roundTime);
    this.audioOffset = Math.floor(Math.random() * maxOffset);
    this.roundResult = null;

    this.state = 'round_preparing';
    this.broadcast();

    clearTimeout(this.countdownTimer);
    this.countdownTimer = setTimeout(() => {
      this.roundStartTime = Date.now();
      this.state = 'playing';
      this.broadcast();

      clearTimeout(this.roundTimer);
      this.roundTimer = setTimeout(() => {
        this.endRound();
      }, this.settings.roundTime * 1000);
    }, 3000);
  }

  submitAnswer(playerId, answer) {
    const player = this.getPlayer(playerId);
    if (!player || this.state !== 'playing') return null;

    const track = this.tracks[this.currentRound];
    if (!track) return null;

    const guessTimeMs = Date.now() - this.roundStartTime;

    const artistCorrect = !player.foundArtist && evaluateAnswer(answer, track.artist);
    const titleCorrect = !player.foundTitle && evaluateAnswer(answer, track.name);

    let pointsThisGuess = 0;

    if (artistCorrect) {
      player.foundArtist = true;
      pointsThisGuess += 3;
    }

    if (titleCorrect) {
      player.foundTitle = true;
      pointsThisGuess += 3;
    }

    const bothNow = player.foundArtist && player.foundTitle;
    if (bothNow && !player.foundBoth) {
      player.foundBoth = true;
      pointsThisGuess += 4;

      const position = this.foundOrder.length + 1;
      this.foundOrder.push(playerId);
      if (position === 1) pointsThisGuess += 3;
      else if (position === 2) pointsThisGuess += 2;
      else if (position === 3) pointsThisGuess += 1;

      if (this.io) {
        this.io.to(this.code).emit('new_chat_message', {
          isSystem: true,
          content: `🔥 ${player.name} encontrou a resposta exata!`,
        });
      }
    }

    player.score += pointsThisGuess;
    player.answers.push({
      round: this.currentRound,
      answer,
      artistCorrect,
      titleCorrect,
      points: pointsThisGuess,
    });

    const inputResult = {
      artist_result: artistCorrect ? 'Good' : 'Bad',
      title_result: titleCorrect ? 'Good' : 'Bad',
      points_awarded_this_guess: pointsThisGuess,
      found_both: bothNow,
    };

    const sid = this.playerSockets[playerId];
    if (sid && this.io) {
      this.io.to(sid).emit('input_result', inputResult);
    }

    return { ...inputResult, guessTimeMs, trackId: track.id, genre: track.genre };
  }

  endRound() {
    if (this.roundTimer) { clearTimeout(this.roundTimer); this.roundTimer = null; }

    this.players.forEach(p => {
      if (p.foundArtist && p.foundTitle) {
        p.streak = (p.streak || 0) + 1;
        if (p.streak >= 3) p.score += 4;
        else if (p.streak === 2) p.score += 2;
      } else {
        p.streak = 0;
      }
    });

    const track = this.tracks[this.currentRound];
    this.state = 'round_result';
    this.roundResult = {
      round: this.currentRound + 1,
      correctAnswer: track.name,
      artist: track.artist,
      albumImage: track.albumImage,
    };
    this.broadcast();

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
    if (this.countdownTimer) { clearTimeout(this.countdownTimer); this.countdownTimer = null; }
    if (this.pauseTimer) { clearTimeout(this.pauseTimer); this.pauseTimer = null; }

    this.state = 'finished';
    this.rankings = [...this.players].sort((a, b) => b.score - a.score)
      .map((p, i) => ({ rank: i + 1, name: p.name, score: p.score, answers: p.answers }));
    this.broadcast();
  }

  getState() {
    const base = {
      state: this.state,
      settings: this.getSettings(),
      genres: this.genres,
      players: this.players.map(p => ({
        id: p.id, name: p.name, avatarUrl: p.avatarUrl, role: p.role, score: p.score,
        foundArtist: !!p.foundArtist,
        foundTitle: !!p.foundTitle,
        foundBoth: !!p.foundBoth,
      })),
      currentRound: this.currentRound + 1,
      totalRounds: this.totalRounds,
    };

    const makeDebugTrackInfo = (track) => track ? {
      title: track.title,
      artist: track.artist,
      spotifyId: track.id,
      youtubeVideoId: track.youtubeVideoId,
      provenance: 'Spotify Metadata -> YouTube Audio',
      durationMs: track.durationMs || 30000,
      targetOffset: this.audioOffset,
    } : null;

    if (this.state === 'round_preparing') {
      const track = this.tracks[this.currentRound];
      return {
        ...base,
        _debugTrackInfo: makeDebugTrackInfo(track),
        previewUrl: track?.previewUrl || null,
        youtubeVideoId: track?.youtubeVideoId || null,
        audioOffset: this.audioOffset ?? 0,
        roundTime: this.settings.roundTime,
      };
    }

    if (this.state === 'playing') {
      const elapsed = (Date.now() - this.roundStartTime) / 1000;
      const timeLeft = Math.max(0, Math.ceil(this.settings.roundTime - elapsed));
      const track = this.tracks[this.currentRound];
      return {
        ...base,
        _debugTrackInfo: makeDebugTrackInfo(track),
        timeLeft,
        roundTime: this.settings.roundTime,
        previewUrl: track.previewUrl,
        audioOffset: this.audioOffset ?? 0,
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
    if (this.countdownTimer) clearTimeout(this.countdownTimer);
    if (this.pauseTimer) clearTimeout(this.pauseTimer);
    this.players = [];
    this.tracks = [];
  }
}
