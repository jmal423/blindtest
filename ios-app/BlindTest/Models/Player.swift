import Foundation

struct Player: Codable, Identifiable, Equatable {
    let id: String
    var name: String
    var score: Int
    var avatarUrl: String?
    var role: String?
    var foundArtist: Bool?
    var foundTitle: Bool?
    var foundBoth: Bool?
    var connected: Bool?

    static func == (lhs: Player, rhs: Player) -> Bool { lhs.id == rhs.id }
}

struct GuessMarker: Identifiable {
    let id = UUID()
    let playerName: String
    let artistFound: Bool
    let titleFound: Bool
    let guessTimeMs: Int
}
