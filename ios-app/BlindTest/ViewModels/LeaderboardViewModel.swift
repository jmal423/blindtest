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
final class LeaderboardViewModel: ObservableObject {
    @Published var entries: [LeaderboardEntry] = []
    @Published var isLoading = false

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
        } catch { print("LB error: \(error)") }
        isLoading = false
    }
}
