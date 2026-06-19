import Foundation
import KeychainAccess

final class KeychainService {
    static let shared = KeychainService()
    private let keychain = Keychain(service: "com.blindtest.app")
    private let tokenKey = "auth_token"

    var token: String? {
        get { try? keychain.get(tokenKey) }
        set {
            if let v = newValue {
                try? keychain.set(v, key: tokenKey)
            } else {
                try? keychain.remove(tokenKey)
            }
        }
    }

    func clear() { token = nil }
}
