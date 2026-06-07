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
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitParts(str) {
  return str.split(/[-–—]|,|\s+feat\.?\s*|\s+ft\.?\s*/).map(s => s.trim()).filter(Boolean);
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
  if (!a || !t) return { matched: false, score: 0 };
  if (a === t) return { matched: true, score: 100 };

  // Check if guess matches any part of a multi-part title (e.g. "Dracula - Jennie Remix")
  const targetParts = splitParts(t);
  for (const part of targetParts) {
    if (part === a) return { matched: true, score: 100 };
    const dist = levenshtein(a, part);
    const maxLen = Math.max(a.length, part.length);
    const maxDist = maxLen <= 4 ? 1 : 2;
    if (dist <= maxDist) return { matched: true, score: Math.round((1 - dist / maxLen) * 100) };
  }

  // Check if guess is a substring of target (e.g. "hello" in "hello world")
  const shorter = a.length <= t.length ? a : t;
  const longer = a.length <= t.length ? t : a;
  if (shorter.length >= 3 && longer.includes(shorter)) {
    return { matched: true, score: 100 };
  }

  // Full Levenshtein comparison
  const dist = levenshtein(a, t);
  const maxLen = Math.max(a.length, t.length);
  const ratio = dist / maxLen;

  const maxDist = maxLen <= 4 ? 1 : 2;
  if (dist <= maxDist) return { matched: true, score: Math.round((1 - ratio) * 100) };
  if (ratio <= 0.20) return { matched: true, score: Math.round((1 - ratio) * 100) };
  return { matched: false, score: Math.round((1 - Math.min(ratio, 1)) * 100) };
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
    this.settings = { rounds: 10, roundTime: 15, pauseTime: 4, autoStart: false, audioSource: 'both' };
    this.tracks = [];
    this.trackHistory = [];
    this.players = [];
    this.state = 'waiting';
    this.currentRound = 0;
    this.totalRounds = 0;
    this.tracksPlayed = 0;
    this.roundStartTime = null;
    this.roundTimer = null;
    this.countdownTimer = null;
    this.pauseTimer = null;
    this.pauseInterval = null;
    this.autoStartTimer = null;
    this.audioOffset = 0;
    this.roundResult = null;
    this.rankings = null;
    this.hostId = null;
    this.pauseStartTime = null;
    this.playersReady = new Set();
    this.playbackTimeout = null;
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
    if (updates.audioSource && ['spotify', 'youtube', 'both'].includes(updates.audioSource)) {
      this.settings.audioSource = updates.audioSource;
    }
    if (updates.autoStart !== undefined) {
      const wasAutoStart = this.settings.autoStart;
      this.settings.autoStart = !!updates.autoStart;
      if (!wasAutoStart && this.settings.autoStart && this.players.length >= 2 && this.state === 'waiting') {
        clearTimeout(this.autoStartTimer);
        if (this.io) {
          this.io.to(this.code).emit('new_chat_message', {
            isSystem: true,
            content: `⏳ Auto-starting in 5 seconds...`,
          });
        }
        this.autoStartTimer = setTimeout(() => {
          if (this.state === 'waiting') this.startGame();
        }, 5000);
      }
    }
  }

  addPlayer(name, avatarUrl = null, role = 'user', userId = null) {
    const id = generateId();
    this.players.push({ id, name, avatarUrl, role, userId, score: 0, answers: [] });
    if (!this.hostId) this.hostId = id;
    if (this.settings.autoStart && this.players.length >= 2 && this.state === 'waiting') {
      clearTimeout(this.autoStartTimer);
      if (this.io) {
        this.io.to(this.code).emit('new_chat_message', {
          isSystem: true,
          content: `⏳ Auto-starting in 5 seconds...`,
        });
      }
      this.autoStartTimer = setTimeout(() => {
        if (this.state === 'waiting') this.startGame();
      }, 5000);
    }
    return id;
  }

  getPlayer(id) {
    return this.players.find(p => p.id === id);
  }

  isAdmin(playerId) {
    const p = this.getPlayer(playerId);
    return p?.role === 'admin';
  }

  kickPlayer(targetPlayerId) {
    const idx = this.players.findIndex(p => p.id === targetPlayerId);
    if (idx === -1) return null;
    const kicked = this.players.splice(idx, 1)[0];
    const socketId = this.playerSockets[targetPlayerId];
    if (socketId && this.io) {
      this.io.to(socketId).emit('kicked', { reason: 'You were removed by an admin' });
    }
    delete this.playerSockets[targetPlayerId];
    if (this.hostId === targetPlayerId) {
      this.hostId = this.players[0]?.id || null;
    }
    if (this.players.length === 0) {
      this.destroy();
    } else {
      this.broadcast();
    }
    return kicked;
  }

  async startGame() {
    if (this.players.length === 0) return;
    if (this.state !== 'waiting') return;
    console.log(`[Game] Starting game in room ${this.code} with ${this.players.length} players, genres: [${this.genres.join(', ')}]`);

    // If tracks already injected (test mode), skip Spotify fetch
    if (this.tracks.length === 0) {
      const { getTracksByGenre } = await import('./spotify.js');

      const allTracks = [];
      let lastError = '';
      const totalNeeded = this.settings.audioSource === 'spotify'
        ? Math.max(this.settings.rounds * 2, 20)
        : Math.max(this.settings.rounds * 2, 20);
      const shuffledGenres = shuffle([...this.genres]).slice(0, 5);
      let rateLimited = false;
      for (const genre of shuffledGenres) {
        if (allTracks.length >= totalNeeded) break;
        try {
          const tracks = await getTracksByGenre(genre, 50);
          allTracks.push(...tracks);
        } catch (err) {
          lastError = err.message;
          if (err.message.includes('rate limit')) {
            rateLimited = true;
            await new Promise(r => setTimeout(r, 1500));
          }
          console.error(`Failed to fetch tracks for genre "${genre}":`, err.message);
        }
      }

      if (allTracks.length === 0) {
        if (rateLimited) return 'Spotify search is rate limited. Please wait ~30 seconds and try again.';
        return lastError || 'No tracks found';
      }

      if (this.settings.audioSource === 'spotify') {
        this.tracks = shuffle(allTracks.filter(t => !!t.previewUrl));
      } else {
        this.tracks = shuffle(allTracks);
      }
      this.totalRounds = Math.min(this.settings.rounds, this.tracks.length);

      console.log(`[Game] Room ${this.code}: ${this.tracks.length} tracks available (source: ${this.settings.audioSource}, target: ${this.totalRounds} rounds)`);

      if (this.tracks.length === 0) {
        if (this.settings.audioSource === 'spotify') return 'No tracks with Spotify previews found for these genres. Try different genres or more genres.';
        if (this.settings.audioSource === 'youtube') return 'No tracks with YouTube videos found. YouTube API may be down. Try switching to Spotify.';
        return 'No playable tracks. Try switching audio source or different genres.';
      }

      if (this.tracks.length < 3) {
        return `Only ${this.tracks.length} tracks available. Need at least 3. Try more genres.`;
      }
    }

    this.players.forEach(p => { p.score = 0; p.answers = []; p.streak = 0; });
    this.currentRound = 0;
    this.tracksPlayed = 0;
    this.startRound();
    return null;
  }

  async startRound() {
    if (this.pauseInterval) { clearInterval(this.pauseInterval); this.pauseInterval = null; }
    this.roundStartTime = null;

    while (this.currentRound < this.tracks.length && this.tracksPlayed < this.totalRounds) {
      const track = this.tracks[this.currentRound];
      const wantYouTube = this.settings.audioSource === 'youtube' || this.settings.audioSource === 'both';
      if (wantYouTube && !track.youtubeVideoId) {
        try {
          const { searchYouTubeVideo } = await import('./youtube.js');
          track.youtubeVideoId = await searchYouTubeVideo(track.name, track.artist);
        } catch (err) {
          console.error(`[YouTube] Failed to fetch video for "${track.artist} - ${track.name}":`, err.message);
        }
      }

      const hasAudio = (this.settings.audioSource === 'spotify') ? !!track.previewUrl
        : (this.settings.audioSource === 'youtube') ? !!track.youtubeVideoId
        : !!(track.youtubeVideoId || track.previewUrl);

      if (hasAudio) break;

      console.warn(`Skipping track "${track.artist} - ${track.name}" - no audio source available`);
      this.currentRound++;
    }

    if (this.currentRound >= this.tracks.length || this.tracksPlayed >= this.totalRounds) {
      this.endGame();
      return;
    }

    const track = this.tracks[this.currentRound];

    const nextIdx = this.currentRound + 1;
    if (nextIdx < this.tracks.length) {
      const nextTrack = this.tracks[nextIdx];
      if (nextTrack && !nextTrack.youtubeVideoId && !nextTrack.previewUrl) {
        const { searchYouTubeVideo } = await import('./youtube.js');
        searchYouTubeVideo(nextTrack.name, nextTrack.artist)
          .then(id => { nextTrack.youtubeVideoId = id; })
          .catch(() => {});
      }
    }

    this.foundOrder = [];
    this.playersReady = new Set();
    this.players.forEach(p => {
      p.foundArtist = false;
      p.foundTitle = false;
      p.foundBoth = false;
    });
    const durSec = Math.max(30, (track.durationMs || 180000) / 1000);
    const effectiveDur = track.youtubeVideoId ? durSec : 30;
    const minOff = Math.max(10, Math.floor(effectiveDur * 0.15));
    const maxOff = Math.floor(effectiveDur * 0.55);
    this.audioOffset = Math.floor(Math.random() * Math.max(1, maxOff - minOff)) + minOff;
    this.roundResult = null;

    this.state = 'round_preparing';
    this.broadcast();

    clearTimeout(this.countdownTimer);
    this.countdownTimer = setTimeout(() => {
      this.state = 'playing';
      this.broadcast();
      // Don't start round timer yet — wait for all players' playback_started
      this.playbackTimeout = setTimeout(() => {
        this.startRoundTimer();
      }, 6000);
    }, 8000);
  }

  submitAnswer(playerId, answer) {
    const player = this.getPlayer(playerId);
    if (!player || this.state !== 'playing' || !this.roundStartTime) return null;

    const track = this.tracks[this.currentRound];
    if (!track) return null;

    const guessTimeMs = Date.now() - this.roundStartTime;

    const artistCheck = !player.foundArtist ? evaluateAnswer(answer, track.artist) : { matched: false, score: 100 };
    const titleCheck = !player.foundTitle ? evaluateAnswer(answer, track.name) : { matched: false, score: 100 };
    const artistCorrect = artistCheck.matched;
    const titleCorrect = titleCheck.matched;

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
      artist_score: artistCheck.score,
      title_result: titleCorrect ? 'Good' : 'Bad',
      title_score: titleCheck.score,
      points_awarded_this_guess: pointsThisGuess,
      found_both: bothNow,
      guessTimeMs,
    };

    const sid = this.playerSockets[playerId];
    if (sid && this.io) {
      this.io.to(sid).emit('input_result', inputResult);
    }

    // Broadcast guess_made to all players in the room for progress bar visualization
    if (this.io) {
      this.io.to(this.code).emit('guess_made', {
        playerId,
        playerName: player.name,
        artistFound: artistCorrect && player.foundArtist,
        titleFound: titleCorrect && player.foundTitle,
        bothFound: bothNow,
        guessTimeMs,
      });
    }

    // Persist round result to database
    if (player.userId) {
      import('./db.js').then(({ insertRoundResult }) => {
        insertRoundResult(
          player.userId, this.code, track.genre, track.id,
          guessTimeMs, pointsThisGuess, artistCorrect || titleCorrect
        ).catch(err => console.error('[DB] Failed to save round result:', err.message));
      });
    }

    return { ...inputResult, guessTimeMs, trackId: track.id, genre: track.genre };
  }

  markPlayerReady(playerId) {
    this.playersReady.add(playerId);
    const connectedPlayers = this.players.filter(p => this.playerSockets[p.id]);
    const allReady = connectedPlayers.every(p => this.playersReady.has(p.id));
    if (allReady) {
      if (this.playbackTimeout) { clearTimeout(this.playbackTimeout); this.playbackTimeout = null; }
      this.startRoundTimer();
    }
  }

  startRoundTimer() {
    if (this.roundStartTime || this.state !== 'playing') return;
    if (this.playbackTimeout) { clearTimeout(this.playbackTimeout); this.playbackTimeout = null; }
    this.roundStartTime = Date.now();
    clearTimeout(this.roundTimer);
    this.roundTimer = setTimeout(() => {
      this.endRound();
    }, this.settings.roundTime * 1000);
    // Broadcast timeLeft every second so frontend has an accurate countdown
    if (this.playingInterval) clearInterval(this.playingInterval);
    this.playingInterval = setInterval(() => {
      this.broadcast();
    }, 1000);
  }

  clearPlayingInterval() {
    if (this.playingInterval) { clearInterval(this.playingInterval); this.playingInterval = null; }
  }

  skipRound() {
    if (this.state !== 'round_preparing' && this.state !== 'playing') return;
    if (this.countdownTimer) { clearTimeout(this.countdownTimer); this.countdownTimer = null; }
    if (this.playbackTimeout) { clearTimeout(this.playbackTimeout); this.playbackTimeout = null; }
    if (this.roundTimer) { clearTimeout(this.roundTimer); this.roundTimer = null; }
    this.roundStartTime = null;
    this.clearPlayingInterval();

    this.tracksPlayed++;
    this.currentRound++;
    if (this.currentRound >= this.tracks.length || this.tracksPlayed >= this.totalRounds) {
      this.endGame();
    } else {
      this.startRound();
    }
  }

  endRound() {
    if (this.roundTimer) { clearTimeout(this.roundTimer); this.roundTimer = null; }
    this.roundStartTime = null;
    this.clearPlayingInterval();
    if (this.pauseInterval) { clearInterval(this.pauseInterval); this.pauseInterval = null; }

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
    this.tracksPlayed++;
    this.trackHistory.push({
      round: this.tracksPlayed,
      name: track.name,
      artist: track.artist,
      albumImage: track.albumImage,
    });
    this.state = 'round_result';
    this.roundResult = {
      round: this.tracksPlayed,
      correctAnswer: track.name,
      artist: track.artist,
      albumImage: track.albumImage,
    };
    this.broadcast();

    this.pauseStartTime = Date.now();
    this.pauseInterval = setInterval(() => {
      if (this.state === 'round_result') this.broadcast();
    }, 1000);
    this.pauseTimer = setTimeout(() => {
      this.currentRound++;
      if (this.currentRound >= this.tracks.length || this.tracksPlayed >= this.totalRounds) {
        this.endGame();
      } else {
        this.startRound();
      }
    }, this.settings.pauseTime * 1000);
  }

  endGame() {
    if (this.roundTimer) { clearTimeout(this.roundTimer); this.roundTimer = null; }
    this.clearPlayingInterval();
    if (this.pauseInterval) { clearInterval(this.pauseInterval); this.pauseInterval = null; }
    if (this.countdownTimer) { clearTimeout(this.countdownTimer); this.countdownTimer = null; }
    if (this.pauseTimer) { clearTimeout(this.pauseTimer); this.pauseTimer = null; }

    const sorted = [...this.players].sort((a, b) => b.score - a.score);
    this.state = 'game_over';
    this.rankings = sorted.map((p, i) => {
      const rank = i + 1;
      const placementXp = rank === 1 ? 500 : rank === 2 ? 250 : 0;
      return {
        rank,
        name: p.name,
        score: p.score,
        xp: p.score * 10 + placementXp,
        answers: p.answers,
      };
    });
    this.broadcast();

    // Auto-save game scores for authenticated players
    for (const p of this.players) {
      if (p.userId) {
        import('./db.js').then(({ run }) => {
          const id = crypto.randomUUID();
          run(
            'INSERT INTO game_scores (id, user_id, game_code, score, total_rounds) VALUES (?, ?, ?, ?, ?)',
            [id, p.userId, this.code, p.score, this.totalRounds]
          ).catch(err => console.error('[DB] Failed to save game score:', err.message));
        });
      }
    }
  }

  getState() {
    const base = {
      state: this.state,
      settings: this.getSettings(),
      genres: this.genres,
      hostId: this.hostId,
      players: this.players.map(p => ({
        id: p.id, name: p.name, avatarUrl: p.avatarUrl, role: p.role, score: p.score,
        foundArtist: !!p.foundArtist,
        foundTitle: !!p.foundTitle,
        foundBoth: !!p.foundBoth,
      })),
      currentRound: this.tracksPlayed + 1,
      totalRounds: this.totalRounds,
      trackHistory: this.trackHistory,
    };

    const makeDebugTrackInfo = (track) => track ? {
      title: track.name || track.title,
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
        durationMs: track?.durationMs || 0,
        audioOffset: this.audioOffset ?? 0,
        roundTime: this.settings.roundTime,
      };
    }

    if (this.state === 'playing') {
      const track = this.tracks[this.currentRound];
      if (!this.roundStartTime) {
        return {
          ...base,
          _debugTrackInfo: makeDebugTrackInfo(track),
          timeLeft: null,
          waitingForPlayers: true,
          roundTime: this.settings.roundTime,
          previewUrl: track.previewUrl,
          durationMs: track.durationMs || 0,
          audioOffset: this.audioOffset ?? 0,
          youtubeVideoId: track.youtubeVideoId,
          trackId: track.id,
          playersReady: this.playersReady.size,
          playersTotal: this.players.filter(p => this.playerSockets[p.id]).length,
        };
      }
      const elapsed = (Date.now() - this.roundStartTime) / 1000;
      const timeLeft = Math.max(0, Math.ceil(this.settings.roundTime - elapsed));
      return {
        ...base,
        _debugTrackInfo: makeDebugTrackInfo(track),
        timeLeft,
        waitingForPlayers: false,
        roundTime: this.settings.roundTime,
        previewUrl: track.previewUrl,
        durationMs: track.durationMs || 0,
        audioOffset: this.audioOffset ?? 0,
        youtubeVideoId: track.youtubeVideoId,
        trackId: track.id,
      };
    }

    if (this.state === 'round_result') {
      const pauseElapsed = this.pauseStartTime ? (Date.now() - this.pauseStartTime) / 1000 : 0;
      const pauseTimeLeft = Math.max(0, Math.ceil(this.settings.pauseTime - pauseElapsed));
      return { ...base, roundResult: this.roundResult, pauseTimeLeft, trackHistory: this.trackHistory };
    }

    if (this.state === 'game_over') {
      return { ...base, rankings: this.rankings, trackHistory: this.trackHistory };
    }

    return base;
  }

  resetGame() {
    if (this.roundTimer) clearTimeout(this.roundTimer);
    if (this.countdownTimer) clearTimeout(this.countdownTimer);
    if (this.pauseTimer) clearTimeout(this.pauseTimer);
    if (this.pauseInterval) clearInterval(this.pauseInterval);
    if (this.autoStartTimer) clearTimeout(this.autoStartTimer);
    if (this.playbackTimeout) clearTimeout(this.playbackTimeout);
    this.clearPlayingInterval();
    this.tracks = [];
    this.currentRound = 0;
    this.totalRounds = 0;
    this.tracksPlayed = 0;
    this.state = 'waiting';
    this.foundOrder = [];
    this.roundResult = null;
    this.rankings = [];
    this.audioOffset = 0;
    this.roundStartTime = 0;
    this.playersReady = new Set();
    this.playbackTimeout = null;
    this.players.forEach(p => { p.score = 0; p.answers = []; p.streak = 0; });
    this.lastGenres = null;  // force fresh track fetch on next startGame
    this.broadcast();
    if (this.io) {
      this.io.to(this.code).emit('new_chat_message', {
        isSystem: true,
        content: '🔄 Game reset! Ready for a new round.',
      });
    }
  }

  destroy() {
    if (this.roundTimer) clearTimeout(this.roundTimer);
    if (this.countdownTimer) clearTimeout(this.countdownTimer);
    if (this.pauseTimer) clearTimeout(this.pauseTimer);
    if (this.pauseInterval) clearInterval(this.pauseInterval);
    if (this.playingInterval) clearInterval(this.playingInterval);
    if (this.autoStartTimer) clearTimeout(this.autoStartTimer);
    if (this.playbackTimeout) clearTimeout(this.playbackTimeout);
    this.players = [];
    this.tracks = [];
    this.trackHistory = [];
  }
}
