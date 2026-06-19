import Foundation

struct RoomSettings: Codable {
    var rounds: Int = 10
    var roundTime: Int = 15
    var pauseTime: Int = 4
    var autoStart: Bool = false
    var audioSource: String = "deezer"
    var gameMode: String = "genre"

    enum CodingKeys: String, CodingKey {
        case rounds, roundTime, pauseTime, autoStart, audioSource, gameMode
    }
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
    let trackArtist: String?
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

struct OnboardingPreview: Codable {
    let url: String?
}

struct OnboardingQuiz: Codable {
    let trackName: String?
    let previewUrl: String?
    let options: [QuizOption]?
}

struct QuizOption: Codable {
    let artist: String
    let correct: Bool
}

enum GamePhase: String {
    case waiting, roundPreparing = "round_preparing", playing,
         roundResult = "round_result", gameOver = "game_over"
}
