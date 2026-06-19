# BlindTest SwiftUI iOS App — Complete Reference

## Project Setup

Create a new Xcode project: **File > New > Project > iOS > App**
- Name: `BlindTest`
- Bundle: `com.blindtest.app`
- Interface: **SwiftUI**
- Language: **Swift**
- Min deployment: **iOS 17.0**

Then create the folder structure inside the project (right-click → New Group):

```
BlindTest/
├── BlindTestApp.swift        (auto-generated)
├── Info.plist                (auto-generated)
├── Assets.xcassets           (auto-generated)
├── Models/
│   ├── User.swift
│   ├── GameState.swift
│   ├── Genre.swift
│   ├── Player.swift
│   └── Settings.swift
├── Services/
│   ├── APIClient.swift
│   ├── AuthService.swift
│   ├── SocketService.swift
│   ├── AudioService.swift
│   └── Keychain.swift
├── ViewModels/
│   ├── AuthViewModel.swift
│   ├── LobbyViewModel.swift
│   ├── GameViewModel.swift
│   ├── LeaderboardViewModel.swift
│   └── ProfileViewModel.swift
└── Views/
    ├── ContentView.swift
    ├── MainTabView.swift
    ├── LoginView.swift
    ├── LobbyView.swift
    ├── WaitingRoomView.swift
    ├── PlayingView.swift
    ├── RoundResultView.swift
    ├── PodiumView.swift
    ├── LeaderboardView.swift
    ├── ProfileView.swift
    └── SettingsView.swift
```

## Dependencies (Swift Package Manager)

In Xcode: **File > Add Package Dependencies...**

1. **Socket.IO Client** — `https://github.com/socketio/socket.io-client-swift` (v16+)
2. **KeychainAccess** — `https://github.com/kishikawakatsumi/KeychainAccess` (for secure token storage)

---

## 1. Models

### User.swift

```swift
import Foundation

struct User: Codable, Identifiable {
    let id: String
    var username: String
    var avatarUrl: String?
    var role: String
    var createdAt: String

    enum CodingKeys: String, CodingKey {
        case id, username, role
        case avatarUrl = "avatar_url"
        case createdAt = "created_at"
    }

    var isAdmin: Bool { role == "admin" }
    var avatarURL: URL? { avatarUrl.flatMap { URL(string: $0) } }
}

struct UserStats: Codable {
    let totalPoints: Int
    let averageSpeedMs: Double?
    let bestGenre: String?
    let gamesPlayed: Int
    let avgScore: Double
    let bestScore: Int
    let totalRounds: Int
    let roundPoints: Int
    let perfects: Int
}

struct GameScore: Codable, Identifiable {
    let id: String
    let userId: String
    let gameCode: String
    let score: Int
    let totalRounds: Int
    let playedAt: String
}
```

### GameState.swift

```swift
import Foundation

struct RoomSettings: Codable {
    var rounds: Int = 10
    var roundTime: Int = 15
    var pauseTime: Int = 4
    var autoStart: Bool = false
    var audioSource: String = "deezer"
    var gameMode: String = "genre"
}

struct GameState: Codable {
    let state: String
    let hostId: String?
    let settings: RoomSettings?
    let genres: [String]?
    let artists: [String]?
    var players: [Player]
    let currentRound: Int?
    let totalRounds: Int?
    let roundTime: Int?
    let pauseTimeLeft: Int?
    let previewUrl: String?
    let timeLeft: Int?
    let trackId: String?
    let roundResult: RoundResult?
    let rankings: [Ranking]?
    let trackHistory: [TrackEntry]?
    let skipVotes: Int?
    let skipVotesNeeded: Int?
}

struct RoundResult: Codable {
    let round: Int
    let correctAnswer: String
    let artist: String
    let albumImage: String?
}

struct Ranking: Codable, Identifiable {
    let rank: Int
    let name: String
    let score: Int
    let xp: Int

    var id: Int { rank }
}

struct TrackEntry: Codable, Identifiable {
    let round: Int
    let name: String
    let artist: String
    let albumImage: String?
    let skipped: Bool?

    var id: String { "\(round)-\(name)" }
}

struct GuessResult: Codable {
    let artistResult: String
    let artistScore: Int
    let titleResult: String
    let titleScore: Int
    let pointsAwardedThisGuess: Int
    let foundBoth: Bool
    let guessTimeMs: Int?

    enum CodingKeys: String, CodingKey {
        case artistResult = "artist_result"
        case artistScore = "artist_score"
        case titleResult = "title_result"
        case titleScore = "title_score"
        case pointsAwardedThisGuess = "points_awarded_this_guess"
        case foundBoth = "found_both"
        case guessTimeMs = "guess_time_ms"
    }
}

struct GuessMarker: Identifiable {
    let id = UUID()
    let playerName: String
    let artistFound: Bool
    let titleFound: Bool
    let guessTimeMs: Int
}

// Room creation / join
struct RoomCreateResponse: Codable {
    let code: String
    let playerId: String
    let settings: RoomSettings?
    let genres: [String]?
    let artists: [String]?
}

struct RoomJoinResponse: Codable {
    let code: String
    let playerId: String
}

struct RoomInfo: Codable {
    let code: String
    let state: String?
    let playerCount: Int?
}

// Socket error
struct InputResult: Codable {
    let artistResult: String
    let artistScore: Int
    let titleResult: String
    let titleScore: Int
    let pointsAwardedThisGuess: Int
    let foundBoth: Bool
    let guessTimeMs: Int?

    enum CodingKeys: String, CodingKey {
        case artistResult = "artist_result"
        case artistScore = "artist_score"
        case titleResult = "title_result"
        case titleScore = "title_score"
        case pointsAwardedThisGuess = "points_awarded_this_guess"
        case foundBoth = "found_both"
        case guessTimeMs = "guess_time_ms"
    }
}
```

### Genre.swift

```swift
import Foundation

struct Genre: Codable, Identifiable {
    let id: String
    let label: String
    let group: String?
}

struct GenreGroup: Codable, Identifiable {
    let id: String
    let genreIds: [String]
}

struct GenreResponse: Codable {
    let genres: [Genre]
    let groups: [GenreGroup]
}

struct ArtistGroup: Codable, Identifiable {
    let id: String
    let name: String
    let artists: [String]
}
```

### Player.swift

```swift
import Foundation

struct Player: Codable, Identifiable {
    let id: String
    var name: String
    var score: Int
    var avatarUrl: String?
    var role: String?
    var foundArtist: Bool?
    var foundTitle: Bool?
    var foundBoth: Bool?
    var connected: Bool?
}

// Admin room player
struct AdminPlayer: Codable, Identifiable {
    let id: String
    let name: String
    let score: Int
    let avatarUrl: String?
    let role: String?
    let userId: String?
}
```

### Settings.swift

```swift
import Foundation

struct AppSettings: Codable {
    var masterVolume: Double = 0.2
    var sfxVolume: Double = 0.8
    var autoFocusInput: Bool = true
    var reducedMotion: Bool = false
    var colorblindMode: Bool = false
    var theme: String = "dark"
    var language: String = "en"
}
```

---

## 2. Services

### Keychain.swift

```swift
import Foundation
import KeychainAccess

class KeychainService {
    static let shared = KeychainService()
    private let keychain = Keychain(service: "com.blindtest.app")
    private let tokenKey = "auth_token"

    var token: String? {
        get { try? keychain.get(tokenKey) }
        set {
            if let v = newValue { try? keychain.set(v, key: tokenKey) }
            else { try? keychain.remove(tokenKey) }
        }
    }

    func clear() { token = nil }
}
```

### APIClient.swift

```swift
import Foundation

actor APIClient {
    static let shared = APIClient()
    private let base = URL(string: "https://blindtest.jl423.xyz")!
    private let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.keyDecodingStrategy = .convertFromSnakeCase
        return d
    }()
    private let encoder: JSONEncoder = {
        let e = JSONEncoder()
        e.keyEncodingStrategy = .convertToSnakeCase
        return e
    }()

    // MARK: - Auth

    func getDiscordAuthURL(redirect: String) -> URL {
        var components = URLComponents(url: base.appendingPathComponent("/api/auth/discord"), resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "redirect", value: redirect)]
        return components.url!
    }

    // MARK: - Genres

    func fetchGenres() async throws -> GenreResponse {
        try await get("/api/genres")
    }

    func fetchArtistGroups() async throws -> [ArtistGroup] {
        try await get("/api/artist-groups")
    }

    // MARK: - Rooms

    func createRoom(genres: [String]?, artists: [String]?, gameMode: String?) async throws -> RoomCreateResponse {
        var body: [String: Any] = [:]
        if let g = genres { body["genres"] = g }
        if let a = artists { body["artists"] = a }
        body["gameMode"] = gameMode ?? "genre"
        return try await post("/api/rooms", body: body, auth: true)
    }

    func joinRoom(code: String) async throws -> RoomJoinResponse {
        try await post("/api/rooms/join", body: ["code": code], auth: true)
    }

    func checkRoom(code: String) async throws -> RoomInfo {
        try await get("/api/rooms/\(code)")
    }

    // MARK: - Game

    func startGame(code: String, playerId: String) async throws -> [String: Any] {
        try await post("/api/game/\(code)/start", body: ["playerId": playerId])
    }

    func updateSettings(code: String, playerId: String, settings: [String: Any]) async throws -> RoomSettings {
        var body = settings
        body["playerId"] = playerId
        return try await post("/api/game/\(code)/settings", body: body)
    }

    // MARK: - Leaderboard

    func fetchLeaderboard() async throws -> [[String: Any]] {
        try await get("/api/leaderboard")
    }

    // MARK: - User

    func getMe() async throws -> User {
        try await get("/api/users/me", auth: true)
    }

    func getMyStats() async throws -> UserStats {
        try await get("/api/users/me/stats", auth: true)
    }

    func getUser(id: String) async throws -> User {
        try await get("/api/users/\(id)")
    }

    // MARK: - Auth token exchange

    func exchangeDiscordCode(code: String) async throws -> [String: Any] {
        try await post("/api/auth/discord/activity", body: ["code": code])
    }

    // MARK: - Onboarding

    func getOnboardingPreview() async throws -> [String: String] {
        try await get("/api/onboarding/preview")
    }

    func getOnboardingQuiz() async throws -> [String: Any] {
        try await get("/api/onboarding/quiz")
    }

    // MARK: - Friends

    func getFriends() async throws -> [String: Any] {
        try await get("/api/friends", auth: true)
    }

    func getInvites() async throws -> [[String: Any]] {
        try await get("/api/invites", auth: true)
    }

    // MARK: - Generic HTTP

    private func get<T: Decodable>(_ path: String, auth: Bool = false) async throws -> T {
        var req = URLRequest(url: base.appendingPathComponent(path))
        req.timeoutInterval = 15
        if auth, let token = KeychainService.shared.token {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        let (data, _) = try await URLSession.shared.data(for: req)
        return try decoder.decode(T.self, from: data)
    }

    private func get(_ path: String, auth: Bool = false) async throws -> [[String: Any]] {
        var req = URLRequest(url: base.appendingPathComponent(path))
        req.timeoutInterval = 15
        if auth, let token = KeychainService.shared.token {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        let (data, _) = try await URLSession.shared.data(for: req)
        return try JSONSerialization.jsonObject(with: data) as? [[String: Any]] ?? []
    }

    private func get(_ path: String, auth: Bool = false) async throws -> [String: Any] {
        var req = URLRequest(url: base.appendingPathComponent(path))
        req.timeoutInterval = 15
        if auth, let token = KeychainService.shared.token {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        let (data, _) = try await URLSession.shared.data(for: req)
        return try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]
    }

    private func post<T: Decodable>(_ path: String, body: [String: Any], auth: Bool = false) async throws -> T {
        var req = URLRequest(url: base.appendingPathComponent(path))
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.timeoutInterval = 15
        if auth, let token = KeychainService.shared.token {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, _) = try await URLSession.shared.data(for: req)
        return try decoder.decode(T.self, from: data)
    }

    private func post(_ path: String, body: [String: Any], auth: Bool = false) async throws -> [String: Any] {
        var req = URLRequest(url: base.appendingPathComponent(path))
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.timeoutInterval = 15
        if auth, let token = KeychainService.shared.token {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, _) = try await URLSession.shared.data(for: req)
        return try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]
    }
}
```

### AuthService.swift

```swift
import Foundation
import AuthenticationServices

@MainActor
class AuthService: NSObject, ObservableObject {
    static let shared = AuthService()
    @Published var isAuthenticated = false
    @Published var currentUser: User?
    private var authSession: ASWebAuthenticationSession?

    func login() async throws {
        let scheme = "blindtest"
        let redirect = "\(scheme)://callback"
        let authURL = await APIClient.shared.getDiscordAuthURL(redirect: redirect)

        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            Task { @MainActor in
                self.authSession = ASWebAuthenticationSession(
                    url: authURL,
                    callbackURLScheme: scheme
                ) { callbackURL, error in
                    if let error = error {
                        continuation.resume(throwing: error)
                        return
                    }
                    guard let url = callbackURL,
                          let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
                          let token = components.queryItems?.first(where: { $0.name == "token" })?.value else {
                        continuation.resume(throwing: AuthError.invalidCallback)
                        return
                    }
                    KeychainService.shared.token = token
                    continuation.resume(returning: ())
                }
                self.authSession?.prefersEphemeralWebBrowserSession = true
                self.authSession?.start()
            }
        }

        // Fetch user
        let user = try await APIClient.shared.getMe()
        self.currentUser = user
        self.isAuthenticated = true
    }

    func restoreSession() async {
        guard KeychainService.shared.token != nil else { return }
        do {
            let user = try await APIClient.shared.getMe()
            self.currentUser = user
            self.isAuthenticated = true
        } catch {
            KeychainService.shared.clear()
        }
    }

    func logout() {
        KeychainService.shared.clear()
        currentUser = nil
        isAuthenticated = false
    }
}

enum AuthError: Error {
    case invalidCallback
    case noToken
}
```

### SocketService.swift

```swift
import Foundation
import SocketIO

@MainActor
class SocketService: ObservableObject {
    static let shared = SocketService()

    private let manager: SocketManager
    private var socket: SocketIOClient
    @Published var isConnected = false
    @Published var gameState: GameState?
    @Published var guessResult: GuessResult?
    @Published var guessMarkers: [GuessMarker] = []
    @Published var kicked: Bool = false

    private init() {
        let url = URL(string: "https://blindtest.jl423.xyz")!
        manager = SocketManager(socketURL: url, config: [.log(false), .compress])
        socket = manager.defaultSocket
        setupListeners()
    }

    private func setupListeners() {
        socket.on(clientEvent: .connect) { [weak self] _, _ in
            Task { @MainActor in self?.isConnected = true }
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

    func connect() {
        socket.connect()
    }

    func disconnect() {
        socket.disconnect()
    }

    func joinRoom(code: String, playerId: String) {
        socket.emit("join_room", code, playerId)
    }

    func submitGuess(_ input: String) {
        socket.emit("submit_guess", ["input": input])
    }

    func skipRound() {
        socket.emit("skip_round")
    }

    func playAgain(code: String) {
        socket.emit("play_again", code)
    }

    func sendChat(_ text: String) {
        socket.emit("send_chat_message", ["content": text])
    }

    func flagSong(songId: String) {
        socket.emit("flag_song", ["songId": songId, "reason": "wrong_song"])
    }

    func reset() {
        gameState = nil
        guessResult = nil
        guessMarkers = []
        kicked = false
    }
}
```

### AudioService.swift

```swift
import Foundation
import AVFoundation
import MediaPlayer

class AudioService: ObservableObject {
    static let shared = AudioService()

    private var player: AVPlayer?
    private var playerItem: AVPlayerItem?

    @Published var isPlaying = false
    @Published var currentVolume: Float = 0.5

    init() {
        setupAudioSession()
    }

    private func setupAudioSession() {
        try? AVAudioSession.sharedInstance().setCategory(
            .playback,
            mode: .default,
            options: [.mixWithOthers]
        )
        try? AVAudioSession.sharedInstance().setActive(true)
    }

    func play(url: URL, volume: Float? = nil) {
        stop()
        let item = AVPlayerItem(url: url)
        playerItem = item
        player = AVPlayer(playerItem: item)
        player?.volume = volume ?? currentVolume
        player?.play()
        isPlaying = true

        // Enable system volume control
        let commandCenter = MPRemoteCommandCenter.shared()
        commandCenter.playCommand.addTarget { [weak self] _ in
            self?.player?.play()
            self?.isPlaying = true
            return .success
        }
        commandCenter.pauseCommand.addTarget { [weak self] _ in
            self?.player?.pause()
            self?.isPlaying = false
            return .success
        }
    }

    func stop() {
        player?.pause()
        player = nil
        playerItem = nil
        isPlaying = false
    }

    func setVolume(_ volume: Float) {
        currentVolume = volume
        player?.volume = volume
    }

    // Preview track from proxy
    func playPreview(trackId: String) {
        let urlString = "https://blindtest.jl423.xyz/api/proxy/audio/\(trackId)"
        guard let url = URL(string: urlString) else { return }
        play(url: url)
    }
}
```

---

## 3. ViewModels

### AuthViewModel.swift

```swift
import Foundation

@MainActor
class AuthViewModel: ObservableObject {
    @Published var isLoading = true
    @Published var isLoggedIn = false
    @Published var user: User?

    func initialize() async {
        isLoading = true
        await AuthService.shared.restoreSession()
        user = AuthService.shared.currentUser
        isLoggedIn = AuthService.shared.isAuthenticated
        isLoading = false
    }

    func login() async {
        isLoading = true
        do {
            try await AuthService.shared.login()
            user = AuthService.shared.currentUser
            isLoggedIn = true
        } catch {
            print("Login failed: \(error)")
        }
        isLoading = false
    }

    func logout() {
        AuthService.shared.logout()
        user = nil
        isLoggedIn = false
        SocketService.shared.disconnect()
    }
}
```

### LobbyViewModel.swift

```swift
import Foundation

@MainActor
class LobbyViewModel: ObservableObject {
    @Published var rooms: [RoomInfo] = []
    @Published var createCode: String?
    @Published var genres: [Genre] = []
    @Published var genreGroups: [GenreGroup] = []
    @Published var artistGroups: [ArtistGroup] = []
    @Published var isLoading = false
    @Published var error: String?

    func loadGenres() async {
        do {
            let response = try await APIClient.shared.fetchGenres()
            genres = response.genres
            genreGroups = response.groups
        } catch {
            self.error = "Failed to load genres"
        }
    }

    func loadArtistGroups() async {
        do {
            artistGroups = try await APIClient.shared.fetchArtistGroups()
        } catch {
            self.error = "Failed to load artists"
        }
    }

    func createRoom(genres: [String]? = nil, artists: [String]? = nil, gameMode: String = "genre") async -> String? {
        isLoading = true
        defer { isLoading = false }
        do {
            let resp = try await APIClient.shared.createRoom(genres: genres, artists: artists, gameMode: gameMode)
            createCode = resp.code
            return resp.code
        } catch {
            self.error = "Failed to create room"
            return nil
        }
    }

    func joinRoom(code: String) async -> String? {
        isLoading = true
        defer { isLoading = false }
        do {
            let resp = try await APIClient.shared.joinRoom(code: code.uppercased())
            createCode = resp.code
            return resp.playerId
        } catch {
            self.error = "Room not found or full"
            return nil
        }
    }
}
```

### GameViewModel.swift

```swift
import Foundation

@MainActor
class GameViewModel: ObservableObject {
    @Published var phase: GamePhase = .waiting
    @Published var players: [Player] = []
    @Published var currentRound = 1
    @Published var totalRounds = 10
    @Published var timeLeft: Int?
    @Published var smoothTime: Double = 0
    @Published var previewUrl: String?
    @Published var trackId: String?
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
    @Published var isLoser = false
    @Published var roomCode: String?

    private var timer: Timer?
    private var smoothTimer: Timer?
    private var roundStartTime: Date?

    enum GamePhase: String {
        case waiting, roundPreparing = "round_preparing", playing,
             roundResult = "round_result", gameOver = "game_over"
    }

    func joinRoom(code: String, playerId: String) {
        self.roomCode = code
        self.playerId = playerId
        SocketService.shared.reset()
        SocketService.shared.joinRoom(code: code, playerId: playerId)
    }

    func handleGameState(_ state: GameState) {
        players = state.players ?? []
        hostId = state.hostId
        isHost = state.hostId == playerId
        currentRound = state.currentRound ?? 1
        totalRounds = state.totalRounds ?? 10
        skipVotes = state.skipVotes ?? 0
        skipVotesNeeded = state.skipVotesNeeded ?? 0

        switch state.state {
        case "waiting":
            phase = .waiting
            stopTimers()
        case "round_preparing":
            phase = .roundPreparing
            resetRoundState()
            previewUrl = state.previewUrl
        case "playing":
            phase = .playing
            timeLeft = state.timeLeft
            roundStartTime = Date()
            startTimers(initial: state.timeLeft ?? 15)
        case "round_result":
            phase = .roundResult
            stopTimers()
            roundResult = state.roundResult
            if let rh = state.trackHistory { trackHistory = rh }
            timeLeft = state.pauseTimeLeft
        case "game_over":
            phase = .gameOver
            stopTimers()
            rankings = state.rankings ?? []
            if let rh = state.trackHistory { trackHistory = rh }
        default:
            break
        }
    }

    func handleGuessResult(_ result: GuessResult) {
        guessResult = result
        if result.foundBoth { bothFound = true; titleFound = true; artistFound = true }
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

    private func resetRoundState() {
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
        // Smooth timer for progress bar
        smoothTimer = Timer.scheduledTimer(withTimeInterval: 0.05, repeats: true) { [weak self] _ in
            guard let self = self, let start = self.roundStartTime else { return }
            let elapsed = Date().timeIntervalSince(start)
            Task { @MainActor in
                self.smoothTime = elapsed
            }
        }
    }

    private func stopTimers() {
        timer?.invalidate(); timer = nil
        smoothTimer?.invalidate(); smoothTimer = nil
    }

    deinit { stopTimers() }
}
```

### LeaderboardViewModel.swift

```swift
import Foundation

struct LeaderboardEntry: Identifiable {
    let id: String
    let username: String
    let avatarUrl: String?
    let totalScore: Int
    let gamesPlayed: Int
    let avgScore: Double
    let bestScore: Int
    let wins: Int

    var avatarURL: URL? { avatarUrl.flatMap { URL(string: $0) } }
}

@MainActor
class LeaderboardViewModel: ObservableObject {
    @Published var entries: [LeaderboardEntry] = []
    @Published var isLoading = false
    @Published var error: String?

    func load() async {
        isLoading = true
        do {
            let raw: [[String: Any]] = try await APIClient.shared.fetchLeaderboard()
            entries = raw.map {
                LeaderboardEntry(
                    id: $0["id"] as? String ?? UUID().uuidString,
                    username: $0["username"] as? String ?? "Unknown",
                    avatarUrl: $0["avatar_url"] as? String,
                    totalScore: $0["total_score"] as? Int ?? 0,
                    gamesPlayed: $0["games_played"] as? Int ?? 0,
                    avgScore: $0["avg_score"] as? Double ?? 0,
                    bestScore: $0["best_score"] as? Int ?? 0,
                    wins: $0["wins"] as? Int ?? 0
                )
            }
        } catch {
            self.error = "Failed to load leaderboard"
        }
        isLoading = false
    }
}
```

### ProfileViewModel.swift

```swift
import Foundation

@MainActor
class ProfileViewModel: ObservableObject {
    @Published var stats: UserStats?
    @Published var user: User?
    @Published var isLoading = false

    func load() async {
        isLoading = true
        do {
            user = try await APIClient.shared.getMe()
            stats = try await APIClient.shared.getMyStats()
        } catch {
            print("Profile load failed: \(error)")
        }
        isLoading = false
    }
}
```

---

## 4. Views

### BlindTestApp.swift (entry point)

```swift
import SwiftUI

@main
struct BlindTestApp: App {
    @StateObject private var authVM = AuthViewModel()
    @StateObject private var lobbyVM = LobbyViewModel()
    @StateObject private var gameVM = GameViewModel()
    @StateObject private var lbVM = LeaderboardViewModel()
    @StateObject private var profileVM = ProfileViewModel()
    @StateObject private var socket = SocketService.shared
    @StateObject private var audio = AudioService.shared

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(authVM)
                .environmentObject(lobbyVM)
                .environmentObject(gameVM)
                .environmentObject(lbVM)
                .environmentObject(profileVM)
                .environmentObject(socket)
                .environmentObject(audio)
                .onAppear {
                    Task { await authVM.initialize() }
                }
        }
    }
}
```

### ContentView.swift

```swift
import SwiftUI

struct ContentView: View {
    @EnvironmentObject var authVM: AuthViewModel

    var body: some View {
        Group {
            if authVM.isLoading {
                LoadingView()
            } else if authVM.isLoggedIn {
                MainTabView()
                    .onAppear { SocketService.shared.connect() }
                    .onDisappear { SocketService.shared.disconnect() }
            } else {
                LoginView()
            }
        }
    }
}

struct LoadingView: View {
    var body: some View {
        VStack(spacing: 16) {
            ProgressView()
                .scaleEffect(1.5)
            Text("Loading...")
                .font(.caption)
                .foregroundColor(.secondary)
        }
    }
}
```

### MainTabView.swift

```swift
import SwiftUI

struct MainTabView: View {
    var body: some View {
        TabView {
            LobbyView()
                .tabItem {
                    Label("Lobby", systemImage: "house.fill")
                }

            LeaderboardView()
                .tabItem {
                    Label("Leaderboard", systemImage: "trophy.fill")
                }

            ProfileView()
                .tabItem {
                    Label("Profile", systemImage: "person.fill")
                }

            SettingsView()
                .tabItem {
                    Label("Settings", systemImage: "gear")
                }
        }
        .tint(.indigo)
    }
}
```

### LoginView.swift

```swift
import SwiftUI

struct LoginView: View {
    @EnvironmentObject var authVM: AuthViewModel

    var body: some View {
        VStack(spacing: 32) {
            Spacer()

            VStack(spacing: 8) {
                Text("Blind")
                    .font(.system(size: 48, weight: .black))
                    .foregroundColor(.indigo) +
                Text("Test")
                    .font(.system(size: 48, weight: .black))
                    .foregroundColor(.primary)
            }

            Text("Guess the song, challenge your friends")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)

            Spacer()

            Button(action: { Task { await authVM.login() } }) {
                HStack(spacing: 12) {
                    Image(systemName: "person.fill")
                    Text("Sign in with Discord")
                        .fontWeight(.bold)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(Color(red: 0.345, green: 0.4, blue: 0.95))
                .foregroundColor(.white)
                .clipShape(RoundedRectangle(cornerRadius: 16))
            }
            .padding(.horizontal, 32)

            if authVM.isLoading {
                ProgressView()
            }

            Spacer()
        }
    }
}
```

### LobbyView.swift

```swift
import SwiftUI

struct LobbyView: View {
    @EnvironmentObject var lobbyVM: LobbyViewModel
    @EnvironmentObject var gameVM: GameViewModel
    @EnvironmentObject var authVM: AuthViewModel
    @EnvironmentObject var socket: SocketService
    @State private var joinCode = ""
    @State private var showCreate = false
    @State private var navigateToGame = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                Text("BlindTest")
                    .font(.largeTitle.weight(.black))

                Text("Welcome, \(authVM.user?.username ?? "Player")")
                    .font(.headline)
                    .foregroundColor(.secondary)

                // Join by code
                VStack(spacing: 12) {
                    TextField("Enter room code", text: $joinCode)
                        .textFieldStyle(.roundedBorder)
                        .textCase(.uppercase)
                        .autocapitalization(.allCharacters)
                        .disableAutocorrection(true)

                    Button(action: joinRoom) {
                        Label("Join Room", systemImage: "arrow.right")
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                            .background(Color.indigo)
                            .foregroundColor(.white)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                }
                .padding(.horizontal, 32)

                Button(action: { showCreate = true }) {
                    Label("Create Room", systemImage: "plus")
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(Color.green)
                        .foregroundColor(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .padding(.horizontal, 32)

                if lobbyVM.isLoading {
                    ProgressView()
                }
                if let error = lobbyVM.error {
                    Text(error).foregroundColor(.red).font(.caption)
                }

                Spacer()
            }
            .padding(.top, 40)
            .navigationDestination(isPresented: $navigateToGame) {
                WaitingRoomView()
            }
            .sheet(isPresented: $showCreate) {
                CreateRoomView()
            }
        }
        .onAppear { Task { await lobbyVM.loadGenres() } }
        .onChange(of: lobbyVM.createCode) { code in
            if code != nil { navigateToGame = true }
        }
    }

    private func joinRoom() {
        Task {
            if let pid = await lobbyVM.joinRoom(code: joinCode) {
                gameVM.joinRoom(code: joinCode.uppercased(), playerId: pid)
                navigateToGame = true
            }
        }
    }
}

struct CreateRoomView: View {
    @EnvironmentObject var lobbyVM: LobbyViewModel
    @EnvironmentObject var gameVM: GameViewModel
    @Environment(\.dismiss) var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section("Quick Start") {
                    Button("Create Random Room") {
                        Task {
                            if let code = await lobbyVM.createRoom() {
                                gameVM.joinRoom(code: code, playerId: "")
                                dismiss()
                            }
                        }
                    }
                }
            }
            .navigationTitle("New Room")
        }
    }
}
```

### WaitingRoomView.swift

```swift
import SwiftUI

struct WaitingRoomView: View {
    @EnvironmentObject var gameVM: GameViewModel
    @EnvironmentObject var socket: SocketService
    @Environment(\.dismiss) var dismiss

    var body: some View {
        VStack(spacing: 20) {
            // Header
            VStack(spacing: 4) {
                Text("Room \(gameVM.roomCode ?? "—")")
                    .font(.title.weight(.black))
                if socket.isConnected {
                    Label("Connected", systemImage: "circle.fill")
                        .font(.caption).foregroundColor(.green)
                } else {
                    Label("Connecting...", systemImage: "circle.dashed")
                        .font(.caption).foregroundColor(.orange)
                }
            }
            .padding(.top)

            // Player list
            Text("Players (\(gameVM.players.count))")
                .font(.headline)
            List(gameVM.players) { player in
                HStack {
                    Circle()
                        .fill(Color.indigo.opacity(0.3))
                        .frame(width: 32, height: 32)
                        .overlay(Text(player.name.prefix(1)).fontWeight(.bold))
                    Text(player.name).fontWeight(.semibold)
                    if player.id == gameVM.hostId {
                        Spacer()
                        Image(systemName: "crown.fill").foregroundColor(.yellow).font(.caption)
                    }
                }
            }
            .listStyle(.plain)

            Spacer()

            if gameVM.isHost {
                Button(action: startGame) {
                    Label("Start Game", systemImage: "play.fill")
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(Color.green)
                        .foregroundColor(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 16))
                }
                .padding(.horizontal, 32)
            } else {
                Text("Waiting for host to start...")
                    .foregroundColor(.secondary)
            }

            Button("Leave", role: .destructive) {
                SocketService.shared.disconnect()
                dismiss()
            }
            .padding(.bottom, 32)
        }
        .navigationBarBackButtonHidden(true)
        .onReceive(socket.$gameState) { state in
            if let s = state { gameVM.handleGameState(s) }
        }
        .onChange(of: gameVM.phase) { phase in
            if phase != .waiting {
                // Navigate to playing view
            }
        }
    }

    private func startGame() {
        guard let code = gameVM.roomCode, let pid = gameVM.playerId else { return }
        Task { try? await APIClient.shared.startGame(code: code, playerId: pid) }
    }
}
```

### PlayingView.swift

```swift
import SwiftUI

struct PlayingView: View {
    @EnvironmentObject var gameVM: GameViewModel
    @EnvironmentObject var socket: SocketService
    @EnvironmentObject var audio: AudioService

    var body: some View {
        VStack(spacing: 0) {
            // Round info
            HStack {
                Text("Round \(gameVM.currentRound)/\(gameVM.totalRounds)")
                    .font(.caption.weight(.bold))
                    .foregroundColor(.secondary)
                Spacer()
                if let tl = gameVM.timeLeft {
                    Text("\(tl)s")
                        .font(.title3.weight(.black).monospacedDigit())
                }
            }
            .padding(.horizontal)
            .padding(.top, 8)

            // Timer bar
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color.gray.opacity(0.2))
                        .frame(height: 8)
                    RoundedRectangle(cornerRadius: 4)
                        .fill(gameVM.timeLeft ?? 0 > 5 ? Color.indigo : Color.red)
                        .frame(width: progressWidth(total: geo.size.width), height: 8)
                        .animation(.linear(duration: 0.05), value: gameVM.smoothTime)
                }
            }
            .frame(height: 8)
            .padding(.horizontal)
            .padding(.bottom, 8)

            // Player markers
            ScrollView(.horizontal) {
                HStack(spacing: 8) {
                    ForEach(gameVM.players) { player in
                        VStack(spacing: 2) {
                            Circle()
                                .fill(playerColor(player.id))
                                .frame(width: 28, height: 28)
                                .overlay(Text(player.name.prefix(1)).font(.caption2.weight(.bold)).foregroundColor(.white))
                            Text(player.name).font(.system(size: 8)).fontWeight(.bold)
                            if player.foundBoth == true {
                                Text("BOTH").font(.system(size: 6)).fontWeight(.black).foregroundColor(.green)
                            } else if player.foundArtist == true {
                                Text("ARTIST").font(.system(size: 6)).fontWeight(.black).foregroundColor(.orange)
                            } else if player.foundTitle == true {
                                Text("TITLE").font(.system(size: 6)).fontWeight(.black).foregroundColor(.blue)
                            }
                        }
                        .frame(width: 56)
                    }
                }
                .padding(.horizontal)
            }
            .frame(height: 60)

            // Guess input
            VStack(spacing: 12) {
                TextField("Type your guess...", text: $gameVM.guess)
                    .textFieldStyle(.roundedBorder)
                    .disableAutocorrection(true)
                    .disabled(gameVM.bothFound)
                    .onSubmit { gameVM.submitGuess() }

                Button(action: { gameVM.submitGuess() }) {
                    Text("Guess")
                        .fontWeight(.bold)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(gameVM.bothFound ? Color.gray : Color.indigo)
                        .foregroundColor(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .disabled(gameVM.bothFound)
            }
            .padding(.horizontal)
            .padding(.top, 12)

            // Guess result feedback
            if let r = gameVM.guessResult {
                VStack(spacing: 4) {
                    Text(r.foundBoth ? "✅ Correct!" : "❌ Wrong")
                        .font(.headline.weight(.black))
                    if !r.foundBoth {
                        Text("Artist: \(r.artistResult) (\(r.artistScore)%)")
                        Text("Title: \(r.titleResult) (\(r.titleScore)%)")
                    }
                }
                .font(.caption)
                .padding(8)
                .background(Color(.systemGray6))
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .padding(.horizontal)
            }

            // Skip button
            Button(action: { gameVM.skipRound() }) {
                Label("Skip", systemImage: "forward.fill")
                    .font(.caption.weight(.bold))
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(Color.orange.opacity(0.2))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
            }
            .disabled(gameVM.hasVotedSkip)
            .padding(.top, 8)

            Spacer()
        }
        .onReceive(socket.$guessResult) { r in
            if let r = r { gameVM.handleGuessResult(r) }
        }
    }

    private func progressWidth(total: CGFloat) -> CGFloat {
        guard let roundTime = gameVM.timeLeft else { return total }
        let totalTime: Double = 15
        return CGFloat(max(0, Double(roundTime) / totalTime)) * total
    }

    private func playerColor(_ id: String) -> Color {
        let colors: [Color] = [.indigo, .green, .orange, .red, .pink, .cyan, .purple, .yellow]
        let hash = abs(id.hashValue)
        return colors[hash % colors.count]
    }
}
```

### RoundResultView.swift

```swift
import SwiftUI

struct RoundResultView: View {
    @EnvironmentObject var gameVM: GameViewModel

    var body: some View {
        VStack(spacing: 20) {
            Text("Round \(gameVM.currentRound) Results")
                .font(.title2.weight(.black))

            if let rr = gameVM.roundResult {
                VStack(spacing: 8) {
                    if let img = rr.albumImage, let url = URL(string: img) {
                        AsyncImage(url: url) { phase in
                            if let image = phase.image {
                                image.resizable().scaledToFill()
                            } else {
                                RoundedRectangle(cornerRadius: 12).fill(Color.gray.opacity(0.3))
                            }
                        }
                        .frame(width: 120, height: 120)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                    }

                    Text(rr.correctAnswer)
                        .font(.title3.weight(.bold))
                    Text(rr.artist)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
            }

            // Player scores
            List(gameVM.players.sorted { $0.score > $1.score }) { player in
                HStack {
                    Text(player.name).fontWeight(.semibold)
                    Spacer()
                    Text("\(player.score)")
                        .fontWeight(.black)
                        .monospacedDigit()
                }
            }
            .listStyle(.plain)

            if let pt = gameVM.timeLeft, pt > 0 {
                Text("Next round in \(pt)s...")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding()
    }
}
```

### PodiumView.swift

```swift
import SwiftUI

struct PodiumView: View {
    @EnvironmentObject var gameVM: GameViewModel

    var body: some View {
        VStack(spacing: 24) {
            Text("Game Over!")
                .font(.largeTitle.weight(.black))

            // Podium (top 3)
            let top3 = gameVM.rankings.prefix(3)
            HStack(alignment: .bottom, spacing: 16) {
                ForEach(top3) { entry in
                    VStack(spacing: 8) {
                        Text("#\(entry.rank)")
                            .font(.title3.weight(.black))
                            .foregroundColor(medalColor(entry.rank))
                        Text(entry.name)
                            .font(.headline)
                        Text("\(entry.score)")
                            .font(.title2.weight(.black))
                        Text("XP: \(entry.xp)")
                            .font(.caption)
                    }
                    .padding()
                    .background(
                        RoundedRectangle(cornerRadius: 16)
                            .fill(Color(.systemGray6))
                    )
                    .padding(.top, entry.rank == 1 ? 0 : 20)
                }
            }

            // All rankings
            List(gameVM.rankings) { entry in
                HStack {
                    Text("#\(entry.rank)").fontWeight(.bold).frame(width: 40)
                    Text(entry.name)
                    Spacer()
                    Text("\(entry.score)").fontWeight(.bold).monospacedDigit()
                }
            }
            .listStyle(.plain)

            Button(action: { gameVM.playAgain() }) {
                Label("Play Again", systemImage: "arrow.counterclockwise")
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                    .background(Color.indigo)
                    .foregroundColor(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 16))
            }
            .padding(.horizontal, 32)
        }
        .padding()
    }

    private func medalColor(_ rank: Int) -> Color {
        switch rank {
        case 1: return .yellow
        case 2: return .secondary
        case 3: return .orange
        default: return .primary
        }
    }
}
```

### LeaderboardView.swift

```swift
import SwiftUI

struct LeaderboardView: View {
    @EnvironmentObject var lbVM: LeaderboardViewModel

    var body: some View {
        NavigationStack {
            List(Array(lbVM.entries.enumerated()), id: \.element.id) { index, entry in
                HStack(spacing: 12) {
                    Text("#\(index + 1)")
                        .font(.caption.weight(.black))
                        .frame(width: 32)
                        .foregroundColor(medalColor(index + 1))

                    if let url = entry.avatarURL {
                        AsyncImage(url: url) { phase in
                            Circle().fill(Color.gray.opacity(0.3))
                                .overlay(phase.image?.resizable().scaledToFill())
                        }
                        .frame(width: 36, height: 36)
                        .clipShape(Circle())
                    } else {
                        Circle()
                            .fill(Color.indigo.opacity(0.3))
                            .frame(width: 36, height: 36)
                            .overlay(Text(entry.username.prefix(1)).fontWeight(.bold))
                    }

                    VStack(alignment: .leading, spacing: 2) {
                        Text(entry.username)
                            .fontWeight(.semibold)
                        Text("\(entry.wins) wins · \(entry.gamesPlayed) games")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }

                    Spacer()

                    VStack(alignment: .trailing) {
                        Text("\(entry.totalScore)")
                            .fontWeight(.black)
                            .monospacedDigit()
                        Text("avg \(Int(entry.avgScore))")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                }
                .padding(.vertical, 4)
            }
            .listStyle(.plain)
            .navigationTitle("Leaderboard")
            .refreshable { await lbVM.load() }
        }
        .task { await lbVM.load() }
    }

    private func medalColor(_ rank: Int) -> Color {
        switch rank {
        case 1: return .yellow
        case 2: return .gray
        case 3: return .orange
        default: return .secondary
        }
    }
}
```

### ProfileView.swift

```swift
import SwiftUI

struct ProfileView: View {
    @EnvironmentObject var profileVM: ProfileViewModel
    @EnvironmentObject var authVM: AuthViewModel

    var body: some View {
        NavigationStack {
            List {
                if let user = profileVM.user {
                    Section {
                        HStack(spacing: 16) {
                            Circle()
                                .fill(Color.indigo.opacity(0.3))
                                .frame(width: 60, height: 60)
                                .overlay(Text(user.username.prefix(1)).font(.largeTitle.weight(.bold)))
                            VStack(alignment: .leading) {
                                Text(user.username).font(.title2.weight(.bold))
                                if user.isAdmin {
                                    Text("ADMIN").font(.caption.weight(.black)).foregroundColor(.orange)
                                }
                            }
                        }
                        .padding(.vertical, 8)
                    }
                }

                if let stats = profileVM.stats {
                    Section("Stats") {
                        StatRow(label: "Total Score", value: "\(stats.totalPoints)")
                        StatRow(label: "Games Played", value: "\(stats.gamesPlayed)")
                        StatRow(label: "Best Score", value: "\(stats.bestScore)")
                        StatRow(label: "Perfect Rounds", value: "\(stats.perfects)")
                        StatRow(label: "Avg Score", value: String(format: "%.0f", stats.avgScore))
                        if let genre = stats.bestGenre {
                            StatRow(label: "Best Genre", value: genre)
                        }
                    }
                }

                Section {
                    Button("Sign Out", role: .destructive) { authVM.logout() }
                }
            }
            .navigationTitle("Profile")
        }
        .task { await profileVM.load() }
    }
}

struct StatRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack {
            Text(label).foregroundColor(.secondary)
            Spacer()
            Text(value).fontWeight(.bold).monospacedDigit()
        }
    }
}
```

### SettingsView.swift

```swift
import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var audio: AudioService

    var body: some View {
        NavigationStack {
            List {
                Section("Audio") {
                    VStack {
                        HStack {
                            Image(systemName: "speaker.fill").foregroundColor(.secondary)
                            Slider(value: $audio.currentVolume, in: 0...1)
                            Image(systemName: "speaker.wave.3.fill").foregroundColor(.secondary)
                        }
                        Text("Hardware volume — use iPhone buttons")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                }

                Section("App") {
                    Text("BlindTest v1.0")
                        .foregroundColor(.secondary)
                    Text("Built with SwiftUI")
                        .foregroundColor(.secondary)
                }

                if let user = AuthService.shared.currentUser {
                    Section("Account") {
                        Text(user.username)
                        Text("ID: \(user.id)")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
            }
            .navigationTitle("Settings")
        }
    }
}
```

---

## Info.plist additions

In your Xcode project's `Info.plist`, add:

```xml
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>blindtest</string>
        </array>
    </dict>
</array>
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <false/>
    <key>NSExceptionDomains</key>
    <dict>
        <key>blindtest.jl423.xyz</key>
        <dict>
            <key>NSExceptionAllowsInsecureHTTPLoads</key>
            <false/>
            <key>NSIncludesSubdomains</key>
            <true/>
        </dict>
    </dict>
</dict>
<key>UIBackgroundModes</key>
<array>
    <string>audio</string>
</array>
```

---

## Implementation Order (build step by step)

1. **Create Xcode project** with SwiftUI template
2. Add Swift packages: SocketIO, KeychainAccess
3. Create **Models** (User, GameState, Player, Genre, Settings)
4. Create **Services** (Keychain, APIClient, AuthService, SocketService, AudioService)
5. Create **ViewModels** (Auth, Lobby, Game, Leaderboard, Profile)
6. Create **Views** (Login, MainTab, Lobby, Game, Leaderboard, Profile, Settings)
7. Wire up `BlindTestApp.swift` with all EnvironmentObjects
8. Configure Info.plist (URL scheme, ATS, background audio)
9. Test on iPhone via Xcode

---

## Key Gotchas When Testing

- **OAuth**: The `ASWebAuthenticationSession` must use `blindtest://` URL scheme. Register it in Info.plist and make sure the backend redirects to `blindtest://callback?token=...`
- **Socket.io**: The SocketIO Swift client expects the same origin as web. The `game_state` event is the single source of truth for all UI changes
- **Audio**: `AVAudioPlayer` respects hardware volume natively. The `UIBackgroundModes` key lets audio play when app is backgrounded
- **Timers**: iOS can suspend `Timer` when scrolling. Use `DispatchSourceTimer` or a `Task.sleep` loop for game timers if you experience drift
- **Keyboard**: The guess input field should use `.onSubmit` to capture the "return" key for submitting guesses
