import Foundation

@MainActor
final class GameViewModel: ObservableObject {
    @Published var phase: GamePhase = .waiting
    @Published var players: [Player] = []
    @Published var currentRound = 1
    @Published var totalRounds = 10
    @Published var timeLeft: Int?
    @Published var previewUrl: String?
    @Published var trackId: String?
    @Published var trackArtist: String?
    @Published var roundResult: RoundResult?
    @Published var rankings: [Ranking] = []
    @Published var trackHistory: [TrackEntry] = []
    @Published var guessResult: GuessResult?
    @Published var guessMarkers: [GuessMarker] = []
    @Published var isHost = false
    @Published var playerId: String?
    @Published var hostId: String?
    @Published var skipVotes = 0
    @Published var skipVotesNeeded = 0
    @Published var hasVotedSkip = false
    @Published var guess = ""
    @Published var artistFound = false
    @Published var titleFound = false
    @Published var bothFound = false
    @Published var roomCode: String?
    @Published var roundStartTime: Date?
    @Published var totalRoundsTime: Int = 15

    private var timer: Timer?

    func setPlayerId(_ id: String) { playerId = id }

    func joinRoom(code: String, playerId: String) {
        roomCode = code
        self.playerId = playerId
        SocketService.shared.reset()
        if !SocketService.shared.isConnected {
            SocketService.shared.connect()
        }
        // Give socket a moment to connect before emitting
        Task {
            try? await Task.sleep(nanoseconds: 500_000_000) // 0.5s
            SocketService.shared.joinRoom(code: code, playerId: playerId)
        }
    }

    func handleGameState(_ state: GameState) {
        players = state.players
        hostId = state.hostId
        isHost = state.hostId == playerId
        currentRound = state.currentRound ?? 1
        totalRounds = state.totalRounds ?? 10
        skipVotes = state.skipVotes ?? 0
        skipVotesNeeded = state.skipVotesNeeded ?? 0
        trackId = state.trackId
        trackArtist = state.trackArtist

        switch state.state {
        case "waiting":
            phase = .waiting
            stopTimers()
        case "round_preparing":
            phase = .roundPreparing
            resetRound()
            previewUrl = state.previewUrl
        case "playing":
            phase = .playing
            timeLeft = state.timeLeft
            previewUrl = state.previewUrl
            totalRoundsTime = state.roundTime ?? state.settings?.roundTime ?? 15
            roundStartTime = Date()
            startTimers(initial: state.timeLeft ?? 15)
        case "round_result":
            phase = .roundResult
            stopTimers()
            roundResult = state.roundResult
            if let h = state.trackHistory { trackHistory = h }
            timeLeft = state.pauseTimeLeft
        case "game_over":
            phase = .gameOver
            stopTimers()
            rankings = state.rankings ?? []
            if let h = state.trackHistory { trackHistory = h }
        default:
            break
        }
    }

    func handleGuessResult(_ r: GuessResult) {
        guessResult = r
        if r.foundBoth { bothFound = true; titleFound = true; artistFound = true }
    }

    func submitGuess() {
        guard !guess.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        SocketService.shared.submitGuess(guess)
        guess = ""
    }

    func skipRound() {
        hasVotedSkip = true
        SocketService.shared.skipRound()
    }

    func playAgain() {
        guard let code = roomCode else { return }
        SocketService.shared.playAgain(code: code)
    }

    private func resetRound() {
        guessResult = nil
        guessMarkers = []
        hasVotedSkip = false
        artistFound = false
        titleFound = false
        bothFound = false
        guess = ""
    }

    private func startTimers(initial: Int) {
        stopTimers()
        var count = initial
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            Task { @MainActor in
                count -= 1
                self?.timeLeft = max(0, count)
                if count <= 0 { self?.stopTimers() }
            }
        }
    }

    private func stopTimers() {
        timer?.invalidate(); timer = nil
    }

    deinit {
        timer?.invalidate()
    }
}
