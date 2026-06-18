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

function weightedShuffle(tracks, difficulty = 0) {
  const maxRank = 1000000;
  const weights = tracks.map(t => {
    const rank = t.rank || 0;
    const base = Math.max(rank / maxRank, 0.05);
    return base * (1 - difficulty) + (1 - base) * difficulty;
  });
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (totalWeight <= 0) return shuffle(tracks);

  const result = [];
  const indices = tracks.map((_, i) => i);
  const remainingWeights = [...weights];

  while (indices.length > 0) {
    const total = remainingWeights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    let pick = 0;
    for (let i = 0; i < remainingWeights.length; i++) {
      r -= remainingWeights[i];
      if (r <= 0) { pick = i; break; }
    }
    result.push(tracks[indices[pick]]);
    indices.splice(pick, 1);
    remainingWeights.splice(pick, 1);
  }
  return result;
}

export class GameRoom {
  constructor(code, genres, io) {
    this.code = code;
    this.genres = genres;
    this.roundFoundRates = [];
    this.artists = [];
    this.settings = { rounds: 10, roundTime: 15, pauseTime: 4, autoStart: false, audioSource: 'deezer', gameMode: 'genre', difficulty: 5 };
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
    this.skipVotes = new Set();
    this.io = io;
    this.playerSockets = {};
    this.gameId = null;
    this.discordChannelId = null;
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
    if (updates.audioSource) {
      this.settings.audioSource = 'deezer';
    }
    if (updates.gameMode) {
      this.settings.gameMode = updates.gameMode;
    }
    if (updates.difficulty !== undefined) this.settings.difficulty = Math.max(0, Math.min(10, Math.round(updates.difficulty)));
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

  removePlayer(targetPlayerId) {
    const idx = this.players.findIndex(p => p.id === targetPlayerId);
    if (idx === -1) return null;
    const removed = this.players.splice(idx, 1)[0];
    delete this.playerSockets[targetPlayerId];
    if (this.hostId === targetPlayerId) {
      this.hostId = this.players[0]?.id || null;
    }
    if (this.players.length === 0 && this.state !== 'game_over') {
      this.destroy();
      return removed;
    }
    this.broadcast();
    return removed;
  }

  kickPlayer(targetPlayerId) {
    const target = this.getPlayer(targetPlayerId);
    if (target?.role === 'admin') return null;
    const socketId = this.playerSockets[targetPlayerId];
    const removed = this.removePlayer(targetPlayerId);
    if (!removed) return null;
    if (socketId && this.io) {
      this.io.to(socketId).emit('kicked', { reason: 'You were removed by an admin' });
    }
    return removed;
  }

  async startGame() {
    if (this.players.length === 0) return;
    if (this.state !== 'waiting') return;
    console.log(`[Game] Starting game in room ${this.code} with ${this.players.length} players, mode: ${this.settings.gameMode}`);

    if (this.tracks.length === 0) {
      const allTracks = [];
      let lastError = '';
      const totalNeeded = Math.max(this.settings.rounds * 2, 20);
      const seenIds = new Set();

      if (this.settings.gameMode === 'artist') {
        const shuffledArtists = shuffle([...this.artists]).slice(0, 10);
        const targetPerArtist = Math.ceil(totalNeeded / Math.max(shuffledArtists.length, 1));
        const fetchLimitPerArtist = Math.max(targetPerArtist * 2, 10);

        for (const artist of shuffledArtists) {
          try {
            const { getSongsByArtist } = await import('./db.js');
            const { deezerFetch } = await import('./deezer.js');
            
            // 1. Try DB First
            let dbTracks = await getSongsByArtist(artist, fetchLimitPerArtist);
            
            // Batch-refresh preview URLs for DB tracks (Deezer previews expire ~30min)
            let tracks = [];
            const BATCH = 10;
            for (let i = 0; i < dbTracks.length; i += BATCH) {
              const batch = dbTracks.slice(i, i + BATCH);
              await Promise.all(batch.map(async (track) => {
                try {
                  const data = await deezerFetch(`/track/${track.rawId}`);
                  if (data && data.preview) {
                    track.previewUrl = data.preview;
                    tracks.push(track);
                  }
                } catch { /* skip */ }
              }));
            }
            
            // 2. Fallback to Deezer if not enough tracks in DB (e.g. less than half the limit)
            if (tracks.length < Math.max(fetchLimitPerArtist / 2, 5)) {
              console.log(`[Game] Artist "${artist}" has only ${tracks.length} tracks in DB. Fetching from Deezer...`);
              const { getTracksByArtist } = await import('./deezer.js');
              const deezerTracks = await getTracksByArtist(artist, fetchLimitPerArtist);
              
              // Cache them in background
              const { cacheSongs } = await import('./db.js');
              cacheSongs(deezerTracks).catch(err => console.error('[Cache] Failed to cache tracks:', err.message));
              
              // Merge db tracks with deezer tracks uniquely
              const dbIds = new Set(tracks.map(t => t.id));
              for (const dt of deezerTracks) {
                if (!dbIds.has(dt.id)) tracks.push(dt);
              }
            }

            let addedForThisArtist = 0;
            for (const t of tracks) {
              if (!seenIds.has(t.id) && t.previewUrl) {
                if (!t.genre && t.genres && t.genres.length > 0) t.genre = t.genres[0];
                else if (!t.genre) t.genre = t.chartSource || 'artist_mode';
                allTracks.push(t);
                seenIds.add(t.id);
                addedForThisArtist++;
                if (addedForThisArtist >= fetchLimitPerArtist) break;
              }
            }
          } catch (err) {
            lastError = err.message;
            console.error(`[Deezer/DB] Failed for artist "${artist}":`, err.message);
          }
        }
      } else {
        const shuffledGenres = shuffle([...this.genres]).slice(0, 10);
        const targetPerGenre = Math.ceil(totalNeeded / Math.max(shuffledGenres.length, 1));
        const fetchLimitPerGenre = Math.max(targetPerGenre * 2, 10);

        for (const genre of shuffledGenres) {
          try {
            const { getTracksByGenre } = await import('./deezer.js');
            const tracks = await getTracksByGenre(genre, fetchLimitPerGenre, this.settings.difficulty);
            let addedForThisGenre = 0;
            for (const t of tracks) {
              if (!seenIds.has(t.id) && t.previewUrl) {
                if (!t.genre && t.genres && t.genres.length > 0) {
                  t.genre = t.genres[0];
                } else if (!t.genre) {
                  t.genre = t.chartSource || genre;
                }
                allTracks.push(t);
                seenIds.add(t.id);
                addedForThisGenre++;
                if (addedForThisGenre >= fetchLimitPerGenre) break;
              }
            }
            const { cacheSongs } = await import('./db.js');
            await cacheSongs(tracks).catch(err => console.error('[Cache] Failed to cache tracks:', err.message));
          } catch (err) {
            lastError = err.message;
            console.error(`[Deezer] Failed for genre "${genre}":`, err.message);
          }
        }
      }

      if (allTracks.length === 0) {
        console.log(`[Game] No tracks from selected ${this.settings.gameMode}s, fetching global top chart as fallback`);
        try {
          const { getTracksByGenre } = await import('./deezer.js');
          const fallback = await getTracksByGenre('pop', 50, this.settings.difficulty);
          for (const t of fallback) {
            if (!seenIds.has(t.id) && t.previewUrl) {
              if (!t.genre && t.genres?.length) t.genre = t.genres[0];
              else if (!t.genre) t.genre = t.chartSource || 'pop';
              allTracks.push(t);
              seenIds.add(t.id);
            }
          }
        } catch (err) {
          console.error('[Game] Fallback search also failed:', err.message);
        }
      }

      if (allTracks.length === 0) {
        return (lastError || 'No tracks found. Try different genres.');
      }

      const diffFactor = (this.settings.difficulty ?? 5) / 10;
      this.tracks = weightedShuffle(allTracks.filter(t => !!t.previewUrl), diffFactor);
      this.totalRounds = Math.min(this.settings.rounds, this.tracks.length);

      console.log(`[Game] Room ${this.code}: ${this.tracks.length} tracks available (target: ${this.totalRounds} rounds)`);

      if (this.tracks.length === 0) {
        return 'No tracks with previews found for these genres. Try different genres.';
      }

      if (this.tracks.length < 3) {
        return `Only ${this.tracks.length} tracks available. Need at least 3. Try more genres.`;
      }
    }

    this.players.forEach(p => { p.score = 0; p.answers = []; p.streak = 0; });
    this.currentRound = 0;
    this.tracksPlayed = 0;
    this.gameId = crypto.randomUUID();

    // Persist game to database
    import('./db.js').then(({ createGame }) => {
      createGame(this.gameId, this.code, this.genres, this.settings.audioSource, this.totalRounds, this.settings.roundTime)
        .then(() => console.log(`[DB] Game ${this.gameId} created (${this.code})`))
        .catch(err => console.error('[DB] Failed to create game:', err.message));
    }).catch(() => {});

    this.startRound();

    // Post game start announcement to Discord webhook if configured
    if (process.env.GAME_START_WEBHOOK_URL) {
      const genreCount = this.genres?.length || 0;
      const artistCount = this.artists?.length || 0;
      const mode = this.settings.gameMode || 'genre';
      const selection = mode === 'genre'
        ? `${genreCount} genre${genreCount !== 1 ? 's' : ''}`
        : `${artistCount} artist${artistCount !== 1 ? 's' : ''}`;
      fetch(process.env.GAME_START_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `🎵 **Game starting!** Room **${this.code}** • ${this.players.length} players • ${selection}`,
        }),
      }).catch(() => {});
    }

    return null;
  }

  async startRound() {
    if (this.pauseInterval) { clearInterval(this.pauseInterval); this.pauseInterval = null; }
    this.roundStartTime = null;
    this.skipVotes = new Set();

    // Clear chat for new round
    if (this.io) {
      this.io.to(this.code).emit('chat_clear');
      this.io.to(this.code).emit('new_chat_message', {
        isSystem: true,
        content: `🎵 Round ${this.tracksPlayed + 1}`,
      });
    }

    // Skip tracks without preview audio
    while (this.currentRound < this.tracks.length && this.tracksPlayed < this.totalRounds) {
      const track = this.tracks[this.currentRound];
      if (track.previewUrl) break;
      console.warn(`Skipping track "${track.artist} - ${track.name}" - no preview URL`);
      this.currentRound++;
    }

    if (this.currentRound >= this.tracks.length || this.tracksPlayed >= this.totalRounds) {
      this.endGame();
      return;
    }

    const track = this.tracks[this.currentRound];

    this.foundOrder = [];
    this.playersReady = new Set();
    const isArtistMode = this.settings.gameMode === 'artist';
    this.players.forEach(p => {
      p.foundArtist = isArtistMode;
      p.foundTitle = false;
      p.foundBoth = false;
    });

    // 30s preview — center the round window within the clip
    const previewDuration = 30;
    this.audioOffset = Math.max(0, Math.floor((previewDuration - this.settings.roundTime) / 2));
    this.roundResult = null;

    if (this.tracksPlayed === 0) {
      this.state = 'round_preparing';
      this.broadcast();

      clearTimeout(this.countdownTimer);
      this.countdownTimer = setTimeout(() => {
        this.state = 'playing';
        this.startRoundTimer();
        this.broadcast();
      }, 3000);
    } else {
      this.state = 'playing';
      this.startRoundTimer();
      this.broadcast();
    }
  }

  submitAnswer(playerId, answer) {
    const player = this.getPlayer(playerId);
    if (!player || this.state !== 'playing') return null;

    const track = this.tracks[this.currentRound];
    if (!track) return null;

    const guessTimeMs = this.roundStartTime ? Date.now() - this.roundStartTime : 0;

    const isArtistMode = this.settings.gameMode === 'artist';
    const artistNeeded = !isArtistMode;

    const artistCheck = artistNeeded && !player.foundArtist ? evaluateAnswer(answer, track.artist) : { matched: false, score: 100 };
    const titleCheck = !player.foundTitle ? evaluateAnswer(answer, track.name) : { matched: false, score: 100 };
    const artistCorrect = artistNeeded && artistCheck.matched;
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

    const bothNow = player.foundTitle && player.foundArtist;
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
          content: `🔥 ${player.name} found the exact answer!`,
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
    if (this.gameId) {
      import('./db.js').then(({ addRoundResultV2, insertRoundResult, recordSongFound, recordSongPlayed }) => {
        addRoundResultV2(
          crypto.randomUUID(), this.gameId, player.userId || player.id, player.name,
          this.tracksPlayed + 1, track.name, track.artist, track.genre,
          answer, guessTimeMs, pointsThisGuess,
          artistCorrect, titleCorrect, bothNow
        ).then(() => {
          console.log(`[DB] R${this.tracksPlayed + 1} ${player.name}: ${pointsThisGuess}pts (${answer})`);
        }).catch(err => console.error('[DB] Failed to save round result v2:', err.message));

        // Track difficulty: if player found the song, increment found_count
        if (bothNow && track.id) {
          recordSongFound(track.id).catch(() => {});
        }

        // Also save to old table for authenticated users
        if (player.userId) {
          insertRoundResult(
            player.userId, this.code, track.genre, track.id,
            guessTimeMs, pointsThisGuess, artistCorrect || titleCorrect
          ).catch(err => console.error('[DB] Failed to save round result:', err.message));
        }
      }).catch(() => {});
    }

    return { ...inputResult, guessTimeMs, trackId: track.id, genre: track.genre };
  }

  markPlayerReady(playerId) {
    this.playersReady.add(playerId);
  }

  startRoundTimer() {
    if (this.roundStartTime) return;
    if (this.state !== 'playing') return;
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

  voteSkip(playerId, isAdmin, isHost) {
    if (this.state !== 'round_preparing' && this.state !== 'playing') return { skipped: false, votes: this.skipVotes.size, needed: 0 };

    // Admin or host skips immediately
    if (isAdmin || isHost) {
      this.skipRound();
      return { skipped: true, votes: this.skipVotes.size, needed: 0 };
    }

    // Regular player: add vote
    this.skipVotes.add(playerId);
    const needed = Math.ceil(this.players.length / 2);

    if (this.skipVotes.size >= needed) {
      this.skipRound();
      return { skipped: true, votes: this.skipVotes.size, needed };
    }

    return { skipped: false, votes: this.skipVotes.size, needed };
  }

  skipRound() {
    if (this.state !== 'round_preparing' && this.state !== 'playing') return;
    if (this.countdownTimer) { clearTimeout(this.countdownTimer); this.countdownTimer = null; }
    if (this.roundTimer) { clearTimeout(this.roundTimer); this.roundTimer = null; }
    this.roundStartTime = null;
    this.clearPlayingInterval();

    const track = this.tracks[this.currentRound];
    if (!track) {
      this.currentRound++;
      if (this.currentRound >= this.tracks.length || this.tracksPlayed >= this.totalRounds) {
        this.endGame();
      } else {
        this.startRound();
      }
      return;
    }

    this.tracksPlayed++;
    this.trackHistory.push({
      round: this.trackHistory.length + 1,
      name: track.name,
      artist: track.artist,
      albumImage: track.albumImage,
      rank: track.rank ?? 0,
      skipped: true,
    });
    if (this.trackHistory.length > 100) this.trackHistory = this.trackHistory.slice(-100);

    if (this.gameId && track.id) {
      import('./db.js').then(({ recordPlay, incrementCuratedPlayedCount }) => {
        recordPlay(track.id, this.gameId)
          .then(() => console.log(`[DB] Recorded play: ${track.name}`))
          .catch(err => console.error('[DB] Failed to record play:', err.message));
        incrementCuratedPlayedCount(track.id).catch(() => {});
      }).catch(() => {});
    }

    this.state = 'round_result';
    this.roundResult = {
      round: this.tracksPlayed,
      correctAnswer: track.name,
      artist: track.artist,
      albumImage: track.albumImage,
      rank: track.rank ?? 0,
      skipped: true,
    };
    this.broadcast();

    if (this.pauseInterval) { clearInterval(this.pauseInterval); this.pauseInterval = null; }
    this.pauseStartTime = Date.now();
    this.pauseDuration = 3;
    this.pauseInterval = setInterval(() => {
      if (this.state === 'round_result') this.broadcast();
    }, 1000);
    this.pauseTimer = setTimeout(() => {
      if (this.pauseInterval) { clearInterval(this.pauseInterval); this.pauseInterval = null; }
      this.currentRound++;
      if (this.currentRound >= this.tracks.length || this.tracksPlayed >= this.totalRounds) {
        this.endGame();
      } else {
        this.startRound();
      }
    }, this.pauseDuration * 1000);
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
      round: this.trackHistory.length + 1,
      name: track.name,
      artist: track.artist,
      albumImage: track.albumImage,
      rank: track.rank ?? 0,
      skipped: false,
    });
    if (this.trackHistory.length > 100) this.trackHistory = this.trackHistory.slice(-100);

    // Record this song as played for recency weighting and difficulty
    if (this.gameId && track.id) {
      import('./db.js').then(({ recordPlay, incrementCuratedPlayedCount, recordSongPlayed }) => {
        recordPlay(track.id, this.gameId)
          .then(() => console.log(`[DB] Recorded play: ${track.name}`))
          .catch(err => console.error('[DB] Failed to record play:', err.message));
        incrementCuratedPlayedCount(track.id).catch(() => {});
        recordSongPlayed(track.id).catch(() => {});
      }).catch(() => {});
    }

    this.state = 'round_result';
    this.roundResult = {
      round: this.tracksPlayed,
      correctAnswer: track.name,
      artist: track.artist,
      albumImage: track.albumImage,
      rank: track.rank ?? 0,
    };
    this.broadcast();

    this.pauseStartTime = Date.now();
    this.pauseDuration = this.settings.pauseTime;
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
        avatarUrl: p.avatarUrl,
        score: p.score,
        xp: p.score * 10 + placementXp,
        answers: p.answers,
      };
    });
    this.trackHistory = [];
    this.broadcast();

    // Persist game results to database
    if (this.gameId) {
      import('./db.js').then(({ finishGame, addGamePlayer }) => {
        finishGame(this.gameId).then(() => {
          console.log(`[DB] Game ${this.gameId} finished`);
        }).catch(err => console.error('[DB] Failed to finish game:', err.message));

        for (const p of this.players) {
          const playerIdForDb = p.userId || p.id;
          const pos = this.rankings.findIndex(r => r.name === p.name) + 1;
          addGamePlayer(crypto.randomUUID(), this.gameId, playerIdForDb, p.name, p.score, pos || this.players.length)
            .then(() => console.log(`[DB] Saved player ${p.name}: ${p.score}pts (position ${pos})`))
            .catch(err => console.error(`[DB] Failed to save player ${p.name}:`, err.message));
        }
      }).catch(() => {});
    }

    // Post game results to Discord webhook if configured
    if (process.env.GAME_WEBHOOK_URL && this.rankings?.length > 0) {
      const top = this.rankings.slice(0, 5);
      const fields = top.map((r, i) => ({
        name: `${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${r.rank}`} ${r.name}`,
        value: `${r.score.toLocaleString()} pts • ${r.xp} XP`,
        inline: true,
      }));
      fetch(process.env.GAME_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `🎵 **Game Over!** ${this.players.length} players • ${this.code}`,
          embeds: [{
            color: 0x6c5ce7,
            fields,
            timestamp: new Date().toISOString(),
          }],
        }),
      }).catch(() => {});
    }
  }

  getSkipVoteInfo() {
    const needed = Math.ceil(this.players.length / 2);
    return { skipVotes: this.skipVotes.size, skipVotesNeeded: needed };
  }

  getState() {
    const base = {
      state: this.state,
      settings: this.getSettings(),
      genres: this.genres,
      artists: this.artists,
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

    const skipVoteInfo = this.getSkipVoteInfo();

    const makeDebugTrackInfo = (track) => {
      if (!track) return null;
      return {
        title: track.name || track.title,
        artist: track.artist,
        id: track.id,
        source: track.id?.startsWith('deezer:') ? 'Deezer' : 'Unknown',
        durationMs: track.durationMs || 30000,
        targetOffset: this.audioOffset,
        rank: track.rank ?? 0,
        genre: track.genre,
      };
    };

    if (this.state === 'round_preparing') {
      const track = this.tracks[this.currentRound];
      return {
        ...base,
        ...skipVoteInfo,
        _debugTrackInfo: makeDebugTrackInfo(track),
        previewUrl: track?.previewUrl || null,
        roundTime: this.settings.roundTime,
      };
    }

    if (this.state === 'playing') {
      const track = this.tracks[this.currentRound];
      const elapsed = this.roundStartTime ? (Date.now() - this.roundStartTime) / 1000 : 0;
      const timeLeft = this.roundStartTime ? Math.max(0, Math.ceil(this.settings.roundTime - elapsed)) : this.settings.roundTime;
      return {
        ...base,
        ...skipVoteInfo,
        _debugTrackInfo: makeDebugTrackInfo(track),
        timeLeft,
        roundTime: this.settings.roundTime,
        previewUrl: track.previewUrl,
        trackId: track.id,
        trackArtist: track.artist,
        gameMode: this.settings.gameMode,
      };
    }

    if (this.state === 'round_result') {
      const pauseElapsed = this.pauseStartTime ? (Date.now() - this.pauseStartTime) / 1000 : 0;
      const pauseTimeLeft = Math.max(0, Math.ceil((this.pauseDuration || this.settings.pauseTime) - pauseElapsed));
      return { ...base, roundResult: this.roundResult, pauseTimeLeft, trackHistory: this.trackHistory };
    }

    if (this.state === 'game_over') {
      return { ...base, currentRound: this.tracksPlayed, rankings: this.rankings, trackHistory: this.trackHistory };
    }

    return base;
  }

  resetGame() {
    if (this.roundTimer) clearTimeout(this.roundTimer);
    if (this.countdownTimer) clearTimeout(this.countdownTimer);
    if (this.pauseTimer) clearTimeout(this.pauseTimer);
    if (this.pauseInterval) clearInterval(this.pauseInterval);
    if (this.autoStartTimer) clearTimeout(this.autoStartTimer);
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
    this.roundStartTime = null;
    this.playersReady = new Set();
    this.skipVotes = new Set();
    this.players.forEach(p => { p.score = 0; p.answers = []; p.streak = 0; });
    this.lastGenres = null;
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
    this.players = [];
    this.tracks = [];
    this.trackHistory = [];
  }
}