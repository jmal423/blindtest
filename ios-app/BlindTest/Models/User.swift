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
