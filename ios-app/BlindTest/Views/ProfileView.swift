import SwiftUI

struct ProfileView: View {
    @EnvironmentObject var profileVM: ProfileViewModel
    @EnvironmentObject var authVM: AuthViewModel

    var body: some View {
        NavigationStack {
            List {
                if let user = profileVM.user {
                    Section {
                        HStack(spacing: 16) {
                            if let url = user.avatarURL {
                                AsyncImage(url: url) { phase in
                                    if let image = phase.image {
                                        image.resizable().scaledToFill()
                                    } else {
                                        Circle().fill(Color.indigo.opacity(0.3))
                                    }
                                }
                                .frame(width: 60, height: 60).clipShape(Circle())
                            } else {
                                Circle()
                                    .fill(Color.indigo.opacity(0.3))
                                    .frame(width: 60, height: 60)
                                    .overlay(Text(user.username.prefix(1)).font(.largeTitle.weight(.bold)))
                            }
                            VStack(alignment: .leading, spacing: 4) {
                                Text(user.username).font(.title2.weight(.bold))
                                Text("Joined \(user.createdAt.prefix(10))")
                                    .font(.caption).foregroundColor(.secondary)
                                if user.isAdmin {
                                    Text("ADMIN").font(.caption2.weight(.black))
                                        .foregroundColor(.orange)
                                        .padding(.horizontal, 6)
                                        .padding(.vertical, 2)
                                        .background(Color.orange.opacity(0.15))
                                        .clipShape(RoundedRectangle(cornerRadius: 4))
                                }
                            }
                        }
                        .padding(.vertical, 8)
                    }
                }

                if let stats = profileVM.stats {
                    Section("Stats") {
                        StatRow(label: "Total Score", value: "\(stats.totalPoints)")
                        StatRow(label: "Games Played", value: "\(stats.gamesPlayed)")
                        StatRow(label: "Best Score", value: "\(stats.bestScore)")
                        StatRow(label: "Perfect Rounds", value: "\(stats.perfects)")
                        StatRow(label: "Avg Score", value: String(format: "%.0f", stats.avgScore))
                        if let g = stats.bestGenre {
                            StatRow(label: "Best Genre", value: g)
                        }
                        if let speed = stats.averageSpeedMs {
                            StatRow(label: "Avg Speed", value: String(format: "%.1fs", speed / 1000))
                        }
                    }
                }

                Section {
                    Button("Sign Out", role: .destructive) { authVM.logout() }
                }
            }
            .navigationTitle("Profile")
        }
        .task { await profileVM.load() }
    }
}

struct StatRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack {
            Text(label).foregroundColor(.secondary)
            Spacer()
            Text(value).fontWeight(.bold).monospacedDigit()
        }
    }
}
