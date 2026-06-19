import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var audio: AudioService
    @EnvironmentObject var authVM: AuthViewModel
    @AppStorage("masterVolume") private var masterVolume: Double = 0.5
    @AppStorage("sfxVolume") private var sfxVolume: Double = 0.8
    @AppStorage("reducedMotion") private var reducedMotion = false {
        didSet { UIAccessibility.isReduceMotionEnabled = reducedMotion }
    }
    @AppStorage("colorblindMode") private var colorblindMode = false
    @AppStorage("theme") private var theme = "dark"
    @AppStorage("language") private var language = "en"

    let themes = ["dark", "light", "synthwave", "terminal", "noir", "fire"]
    let languages = ["en", "pt", "fr", "es"]
    let themeNames = ["Dark", "Light", "Synthwave", "Terminal", "Neon Noir", "Fire"]
    let languageNames = ["English", "Português", "Français", "Español"]

    var body: some View {
        NavigationStack {
            List {
                Section("Audio") {
                    VStack(spacing: 12) {
                        VStack(spacing: 4) {
                            HStack {
                                Image(systemName: "speaker.fill").foregroundColor(.secondary)
                                Slider(value: $masterVolume, in: 0...1)
                                Image(systemName: "speaker.wave.3.fill").foregroundColor(.secondary)
                            }
                            .onChange(of: masterVolume) { _, v in audio.currentVolume = Float(v) }
                            Text("Music volume \u{2022} Hardware buttons also work")
                                .font(.caption2).foregroundColor(.secondary)
                        }
                        VStack(spacing: 4) {
                            HStack {
                                Image(systemName: "bell.fill").foregroundColor(.secondary)
                                Slider(value: $sfxVolume, in: 0...1)
                                Image(systemName: "bell.badge.fill").foregroundColor(.secondary)
                            }
                            Text("Sound effects")
                                .font(.caption2).foregroundColor(.secondary)
                        }
                    }
                }

                Section("Appearance") {
                    Picker("Theme", selection: $theme) {
                        ForEach(Array(themes.enumerated()), id: \.element) { i, t in
                            Text(themeNames[i]).tag(t)
                        }
                    }
                    .onChange(of: theme) { _, _ in applyAppearance() }

                    Picker("Language", selection: $language) {
                        ForEach(Array(languages.enumerated()), id: \.element) { i, l in
                            Text(languageNames[i]).tag(l)
                        }
                    }
                }

                Section("Accessibility") {
                    Toggle("Reduced Motion", isOn: $reducedMotion)
                        .onChange(of: reducedMotion) { _, v in
                            UIAccessibility.isReduceMotionEnabled = v
                        }
                    Toggle("Colorblind Mode", isOn: $colorblindMode)
                }

                Section("Account") {
                    if let user = authVM.user {
                        HStack {
                            Text("Username")
                            Spacer()
                            Text(user.username).foregroundColor(.secondary)
                        }
                        HStack {
                            Text("ID")
                            Spacer()
                            Text(user.id).foregroundColor(.secondary).font(.caption)
                        }
                    }
                    Button("Sign Out", role: .destructive) { authVM.logout() }
                }

                Section("About") {
                    Text("BlindTest v1.0")
                    Text("Built with SwiftUI + Socket.IO")
                        .font(.caption).foregroundColor(.secondary)
                }
            }
            .navigationTitle("Settings")
        }
        .onAppear { applyAppearance() }
    }

    private func applyAppearance() {
        guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let window = windowScene.windows.first else { return }
        window.overrideUserInterfaceStyle = theme == "light" ? .light : .dark
    }
}
