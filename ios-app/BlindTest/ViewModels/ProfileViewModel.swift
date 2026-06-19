import Foundation

@MainActor
final class ProfileViewModel: ObservableObject {
    @Published var stats: UserStats?
    @Published var user: User?
    @Published var isLoading = false

    func load() async {
        isLoading = true
        do {
            user = try await APIClient.shared.getMe()
            stats = try await APIClient.shared.getMyStats()
        } catch { print("Profile error: \(error)") }
        isLoading = false
    }
}
