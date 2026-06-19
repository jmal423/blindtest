import Foundation

@MainActor
final class AuthViewModel: ObservableObject {
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
            print("Login error: \(error)")
        }
        isLoading = false
    }

    func logout() {
        AuthService.shared.logout()
        SocketService.shared.disconnect()
        user = nil
        isLoggedIn = false
    }
}
