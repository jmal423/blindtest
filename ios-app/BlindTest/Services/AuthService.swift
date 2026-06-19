import Foundation
import AuthenticationServices

@MainActor
final class AuthService: NSObject, ObservableObject {
    static let shared = AuthService()
    @Published var isAuthenticated = false
    @Published var currentUser: User?

    private var authSession: ASWebAuthenticationSession?
    private var continuation: CheckedContinuation<Void, Error>?

    func login() async throws {
        let scheme = "blindtest"
        let redirect = "\(scheme)://callback"
        let authURL = await await APIClient.shared.getDiscordAuthURL(redirect: redirect)

        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
            self.continuation = cont
            Task { @MainActor in
                self.authSession = ASWebAuthenticationSession(
                    url: authURL,
                    callbackURLScheme: scheme,
                    completionHandler: self.handleCallback
                )
                self.authSession?.prefersEphemeralWebBrowserSession = true
                self.authSession?.start()
            }
        }

        let user = try await APIClient.shared.getMe()
        self.currentUser = user
        self.isAuthenticated = true
    }

    private func handleCallback(url: URL?, error: Error?) {
        if let error = error {
            continuation?.resume(throwing: error)
            continuation = nil
            return
        }
        guard let url = url,
              let comps = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let token = comps.queryItems?.first(where: { $0.name == "token" })?.value else {
            continuation?.resume(throwing: AuthError.invalidCallback)
            continuation = nil
            return
        }
        KeychainService.shared.token = token
        continuation?.resume(returning: ())
        continuation = nil
    }

    func restoreSession() async {
        guard KeychainService.shared.token != nil else { return }
        do {
            let user = try await APIClient.shared.getMe()
            self.currentUser = user
            self.isAuthenticated = true
        } catch {
            KeychainService.shared.clear()
        }
    }

    func logout() {
        KeychainService.shared.clear()
        currentUser = nil
        isAuthenticated = false
    }
}

enum AuthError: Error {
    case invalidCallback
    case noToken
}
