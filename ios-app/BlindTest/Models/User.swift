import Foundation

struct User: Codable, Identifiable, Equatable {
    let id: String
    var username: String
    var avatarUrl: String?
    var role: String
    var createdAt: String

    var isAdmin: Bool { role == "admin" }
    var avatarURL: URL? { avatarUrl.flatMap { URL(string: $0) } }
}

struct StringOrInt: Codable {
    var value: Int = 0

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if let i = try? c.decode(Int.self) { value = i; return }
        if let s = try? c.decode(String.self) { value = Int(s) ?? 0; return }
        value = 0
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        try c.encode(value)
    }
}

struct StringOrDouble: Codable {
    var value: Double = 0

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if let d = try? c.decode(Double.self) { value = d; return }
        if let i = try? c.decode(Int.self) { value = Double(i); return }
        if let s = try? c.decode(String.self) { value = Double(s) ?? 0; return }
        value = 0
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        try c.encode(value)
    }
}

struct UserStats: Codable {
    let totalPoints: StringOrInt
    let averageSpeedMs: StringOrInt?
    let bestGenre: String?
    let gamesPlayed: StringOrInt
    let avgScore: StringOrDouble?
    let bestScore: StringOrInt
    let totalRounds: StringOrInt
    let roundPoints: StringOrInt
    let perfects: StringOrInt
}

struct GameScore: Codable, Identifiable {
    let id: String
    let userId: String
    let gameCode: String
    let score: StringOrInt
    let totalRounds: StringOrInt
    let playedAt: String
}

struct LeaderboardResponse: Codable, Identifiable {
    let id: String
    let username: String
    let avatarUrl: String?
    let totalScore: StringOrInt
    let gamesPlayed: StringOrInt
    let avgScore: StringOrDouble
    let bestScore: StringOrInt
    let wins: StringOrInt

    var avatarURL: URL? { avatarUrl.flatMap { URL(string: $0) } }
}
