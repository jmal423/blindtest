import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var audio: AudioService
    @EnvironmentObject var authVM: AuthViewModel

    var body: some View {
        NavigationStack {
            List {
                Section("Audio") {
                    VStack(spacing: 4) {
                        HStack {
                            Image(systemName: "speaker.fill").foregroundColor(.secondary)
                            Slider(value: $audio.currentVolume, in: 0...1)
                            Image(systemName: "speaker.wave.3.fill").foregroundColor(.secondary)
                        }
                        Text("Hardware volume buttons also work")
                            .font(.caption2).foregroundColor(.secondary)
                    }
                }

                Section("Onboarding") {
                    Button("Show Tutorial") {
                        // Reset onboarding flag
                    }
                }

                Section("Account") {
                    if let user = authVM.user {
                        Text(user.username)
                        Text("ID: \(user.id)").font(.caption).foregroundColor(.secondary)
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
    }
}
