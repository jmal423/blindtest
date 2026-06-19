import Foundation
import SocketIO

@MainActor
final class SocketService: ObservableObject {
    static let shared = SocketService()

    private let manager: SocketManager
    private var socket: SocketIOClient

    @Published var isConnected = false
    @Published var gameState: GameState?
    @Published var guessResult: GuessResult?
    @Published var guessMarkers: [GuessMarker] = []
    @Published var kicked = false

    private var pendingRoomCode: String?
    private var pendingPlayerId: String?

    private init() {
        let url = URL(string: "https://blindtest.jl423.xyz")!
        manager = SocketManager(socketURL: url, config: [.log(false), .compress])
        socket = manager.defaultSocket
        setupListeners()
    }

    private func setupListeners() {
        socket.on(clientEvent: .connect) { [weak self] _, _ in
            Task { @MainActor in
                self?.isConnected = true
                // Rejoin room if we were in one
                if let code = self?.pendingRoomCode, let pid = self?.pendingPlayerId {
                    self?.socket.emit("join_room", code, pid)
                }
            }
        }
        socket.on(clientEvent: .disconnect) { [weak self] _, _ in
            Task { @MainActor in self?.isConnected = false }
        }
        socket.on("game_state") { [weak self] data, _ in
            guard let json = try? JSONSerialization.data(withJSONObject: data.first ?? []) else { return }
            let state = try? JSONDecoder().decode(GameState.self, from: json)
            Task { @MainActor in self?.gameState = state }
        }
        socket.on("input_result") { [weak self] data, _ in
            guard let json = try? JSONSerialization.data(withJSONObject: data.first ?? []) else { return }
            let r = try? JSONDecoder().decode(GuessResult.self, from: json)
            Task { @MainActor in self?.guessResult = r }
        }
        socket.on("guess_made") { [weak self] data, _ in
            guard let d = data.first as? [String: Any],
                  let name = d["playerName"] as? String else { return }
            Task { @MainActor in
                let marker = GuessMarker(
                    playerName: name,
                    artistFound: d["artistFound"] as? Bool ?? false,
                    titleFound: d["titleFound"] as? Bool ?? false,
                    guessTimeMs: d["guessTimeMs"] as? Int ?? 0
                )
                self?.guessMarkers.append(marker)
            }
        }
        socket.on("kicked") { [weak self] _, _ in
            Task { @MainActor in self?.kicked = true }
        }
    }

    func connect() { socket.connect() }
    func disconnect() { socket.disconnect() }

    func joinRoom(code: String, playerId: String) {
        pendingRoomCode = code
        pendingPlayerId = playerId
        socket.emit("join_room", code, playerId)
    }

    func submitGuess(_ input: String) {
        socket.emit("submit_guess", ["input": input])
    }

    func skipRound() { socket.emit("skip_round") }
    func playAgain(code: String) { socket.emit("play_again", code) }
    func flagSong(songId: String) { socket.emit("flag_song", ["songId": songId, "reason": "wrong_song"]) }
    func sendChat(_ text: String) { socket.emit("send_chat_message", ["content": text]) }
    func hostKick(_ playerId: String) { socket.emit("kick_player", playerId) }
    func transferHost(_ playerId: String) { socket.emit("transfer_host", playerId) }

    func reset() {
        gameState = nil
        guessResult = nil
        guessMarkers = []
        kicked = false
        pendingRoomCode = nil
        pendingPlayerId = nil
    }
}
