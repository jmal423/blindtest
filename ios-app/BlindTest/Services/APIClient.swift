import Foundation

actor APIClient {
    static let shared = APIClient()
    private let base = URL(string: "https://blindtest.jl423.xyz")!
    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()

    init() {
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        encoder.keyEncodingStrategy = .convertToSnakeCase
    }

    // MARK: - Auth
    nonisolated func getDiscordAuthURL(redirect: String) -> URL {
        var comps = URLComponents(url: base.appendingPathComponent("/api/auth/discord"), resolvingAgainstBaseURL: false)!
        comps.queryItems = [URLQueryItem(name: "redirect", value: redirect)]
        return comps.url!
    }

    func exchangeDiscordCode(code: String) async throws -> [String: Any] {
        try await postJSON("/api/auth/discord/activity", body: ["code": code])
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
        try await postJSON("/api/game/\(code)/start", body: ["playerId": playerId])
    }

    func updateSettings(code: String, playerId: String, settings: [String: Any]) async throws -> RoomSettings {
        var body = settings
        body["playerId"] = playerId
        return try await post("/api/game/\(code)/settings", body: body)
    }

    // MARK: - User
    func getMe() async throws -> User {
        try await get("/api/users/me", auth: true)
    }

    func getMyStats() async throws -> UserStats {
        try await get("/api/users/me/stats", auth: true)
    }

    func getMyScores() async throws -> [GameScore] {
        try await get("/api/users/me/scores", auth: true)
    }

    func getGameHistory() async throws -> [[String: Any]] {
        try await getJSON("/api/users/me/history", auth: true)
    }

    // MARK: - Leaderboard
    func fetchLeaderboard() async throws -> [LeaderboardResponse] {
        try await get("/api/leaderboard")
    }

    // MARK: - Onboarding
    func getOnboardingPreview() async throws -> OnboardingPreview {
        try await get("/api/onboarding/preview")
    }

    func getOnboardingQuiz() async throws -> OnboardingQuiz {
        try await get("/api/onboarding/quiz")
    }

    // MARK: - Friends
    func getFriends() async throws -> [String: Any] {
        try await getJSON("/api/friends", auth: true)
    }

    func getInvites() async throws -> [[String: Any]] {
        try await getJSON("/api/invites", auth: true)
    }

    // MARK: - Generic GET
    private func get<T: Decodable>(_ path: String, auth: Bool = false) async throws -> T {
        var req = URLRequest(url: base.appendingPathComponent(path))
        req.timeoutInterval = 15
        if auth, let token = KeychainService.shared.token {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        let (data, _) = try await URLSession.shared.data(for: req)
        return try decoder.decode(T.self, from: data)
    }

    private func getJSON(_ path: String, auth: Bool = false) async throws -> [[String: Any]] {
        var req = URLRequest(url: base.appendingPathComponent(path))
        req.timeoutInterval = 15
        if auth, let token = KeychainService.shared.token {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        let (data, _) = try await URLSession.shared.data(for: req)
        return try JSONSerialization.jsonObject(with: data) as? [[String: Any]] ?? []
    }

    private func getJSONDict(_ path: String, auth: Bool = false) async throws -> [String: Any] {
        var req = URLRequest(url: base.appendingPathComponent(path))
        req.timeoutInterval = 15
        if auth, let token = KeychainService.shared.token {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        let (data, _) = try await URLSession.shared.data(for: req)
        return try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]
    }

    // MARK: - Generic POST
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

    private func postJSON(_ path: String, body: [String: Any], auth: Bool = false) async throws -> [String: Any] {
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
