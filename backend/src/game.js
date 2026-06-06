const ROUND_TIME = 15;
const ROUNDS_PER_GAME = 10;
const POINTS_CORRECT = 100;
const POINTS_BONUS_PER_SECOND = 10;

class GameRoom {
  constructor(code, genres) {
    this.code = code;
    this.genres = genres;
    this.players = [];
    this.state = 'waiting';
    this.currentRound = 0;
    this.tracks = [];
    this.roundStartTime = null;
    this.roundTimer = null;
    this.io = null;
    this.namespace = null;
  }

  addPlayer(id, name) {
    const existing = this.players.find(p => p.id === id);
    if (existing) return existing;

    const player = { id, name, score: 0, answers: [] };
    this.players.push(player);
    return player;
  }

  removePlayer(id) {
    this.players = this.players.filter(p => p.id !== id);
  }

  async startGame(io) {
    if (this.players.length < 1) return;

    this.io = io;

    const allTracks = [];
    for (const genre of this.genres) {
      const { getTracksByGenre } = await import('./spotify.js');
      const tracks = await getTracksByGenre(genre, 10);
      allTracks.push(...tracks);
    }

    this.tracks = shuffle(allTracks).slice(0, ROUNDS_PER_GAME);

    if (this.tracks.length === 0) {
      this.emit('game_error', { message: 'No tracks found for the selected genres. Try different genres.' });
      return;
    }

    this.players.forEach(p => {
      p.score = 0;
      p.answers = [];
    });

    this.state = 'playing';
    this.currentRound = 0;
    this.emit('game_start', {
      totalRounds: this.tracks.length,
      players: this.players.map(p => ({ id: p.id, name: p.name })),
    });

    this.startRound();
  }

  startRound() {
    if (this.currentRound >= this.tracks.length) {
      this.endGame();
      return;
    }

    const track = this.tracks[this.currentRound];
    this.roundStartTime = Date.now();

    this.emit('round_start', {
      round: this.currentRound + 1,
      totalRounds: this.tracks.length,
      timeLimit: ROUND_TIME,
      previewUrl: track.previewUrl,
      trackId: track.id,
    });

    this.roundTimer = setTimeout(() => {
      this.endRound();
    }, ROUND_TIME * 1000);
  }

  submitAnswer(playerId, answer) {
    const player = this.players.find(p => p.id === playerId);
    if (!player || this.state !== 'playing') return;

    const track = this.tracks[this.currentRound];
    const elapsed = (Date.now() - this.roundStartTime) / 1000;
    const isCorrect = answer.toLowerCase().trim() === track.name.toLowerCase().trim();

    let points = 0;
    if (isCorrect) {
      const timeBonus = Math.max(0, Math.floor((ROUND_TIME - elapsed) * POINTS_BONUS_PER_SECOND));
      points = POINTS_CORRECT + timeBonus;
    }

    player.score += points;
    player.answers.push({
      round: this.currentRound,
      answer,
      correct: isCorrect,
      points,
    });

    this.emit('answer_result', {
      playerId,
      correct: isCorrect,
      points,
      correctAnswer: track.name,
      artist: track.artist,
    });
  }

  endRound() {
    if (this.roundTimer) {
      clearTimeout(this.roundTimer);
      this.roundTimer = null;
    }

    const track = this.tracks[this.currentRound];
    this.emit('round_end', {
      round: this.currentRound + 1,
      correctAnswer: track.name,
      artist: track.artist,
      albumImage: track.albumImage,
    });

    setTimeout(() => {
      this.currentRound++;
      this.startRound();
    }, 4000);
  }

  endGame() {
    this.state = 'finished';
    if (this.roundTimer) {
      clearTimeout(this.roundTimer);
      this.roundTimer = null;
    }

    const sorted = [...this.players].sort((a, b) => b.score - a.score);
    this.emit('game_end', {
      rankings: sorted.map((p, i) => ({
        rank: i + 1,
        name: p.name,
        score: p.score,
        answers: p.answers,
      })),
    });
  }

  emit(event, data) {
    if (this.io) {
      this.io.to(this.code).emit(event, data);
    }
  }

  destroy() {
    if (this.roundTimer) {
      clearTimeout(this.roundTimer);
    }
    this.players = [];
    this.tracks = [];
    this.state = 'destroyed';
  }
}

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export { GameRoom, ROUND_TIME, ROUNDS_PER_GAME };
