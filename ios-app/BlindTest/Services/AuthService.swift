import Foundation
import AuthenticationServices

@MainActor
final class AuthService: NSObject, ObservableObject, ASWebAuthenticationPresentationContextProviding {
    static let shared = AuthService()
    @Published var isAuthenticated = false
    @Published var currentUser: User?

    private var authSession: ASWebAuthenticationSession?
    private var continuation: CheckedContinuation<Void, Error>?

    func login() async throws {
        let scheme = "blindtest"
        let redirect = "\(scheme)://callback"
        let authURL = APIClient.shared.getDiscordAuthURL(redirect: redirect)

        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
            self.continuation = cont
            let session = ASWebAuthenticationSession(
                url: authURL,
                callbackURLScheme: scheme,
                completionHandler: self.handleCallback
            )
            session.prefersEphemeralWebBrowserSession = true
            session.presentationContextProvider = self
            session.start()
            self.authSession = session
        }

        let user = try await APIClient.shared.getMe()
        self.currentUser = user
        self.isAuthenticated = true
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .first { $0.isKeyWindow } ?? UIWindow()
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
