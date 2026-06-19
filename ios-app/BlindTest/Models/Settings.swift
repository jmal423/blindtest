import Foundation

struct AppSettings: Codable {
    var masterVolume: Double = 0.2
    var sfxVolume: Double = 0.8
    var autoFocusInput: Bool = true
    var reducedMotion: Bool = false
    var colorblindMode: Bool = false
    var theme: String = "dark"
    var language: String = "en"
}
