import Foundation

@MainActor
final class LeaderboardViewModel: ObservableObject {
    @Published var entries: [LeaderboardResponse] = []
    @Published var isLoading = false

    func load() async {
        isLoading = true
        do {
            entries = try await APIClient.shared.fetchLeaderboard()
        } catch {
            print("Leaderboard error: \(error)")
        }
        isLoading = false
    }
}
