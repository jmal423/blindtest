import Foundation

@MainActor
final class ProfileViewModel: ObservableObject {
    @Published var stats: UserStats?
    @Published var user: User?
    @Published var scores: [GameScore] = []
    @Published var isLoading = false

    func load() async {
        isLoading = true
        do {
            async let u = APIClient.shared.getMe()
            async let s = APIClient.shared.getMyStats()
            async let sc = APIClient.shared.getMyScores()
            (user, stats, scores) = try await (u, s, sc)
        } catch {
            print("Profile error: \(error)")
        }
        isLoading = false
    }
}
