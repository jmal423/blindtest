import SwiftUI

struct LeaderboardView: View {
    @EnvironmentObject var lbVM: LeaderboardViewModel

    var body: some View {
        NavigationStack {
            List(Array(lbVM.entries.enumerated()), id: \.element.id) { index, entry in
                HStack(spacing: 12) {
                    Text("#\(index + 1)")
                        .font(.caption.weight(.black)).frame(width: 32)
                        .foregroundColor(medalColor(index + 1))

                    if let url = entry.avatarURL {
                        AsyncImage(url: url) { phase in
                            Circle().fill(Color.gray.opacity(0.3))
                                .overlay(phase.image?.resizable().scaledToFill())
                        }
                        .frame(width: 36, height: 36).clipShape(Circle())
                    } else {
                        Circle()
                            .fill(Color.indigo.opacity(0.3))
                            .frame(width: 36, height: 36)
                            .overlay(Text(entry.username.prefix(1)).fontWeight(.bold))
                    }

                    VStack(alignment: .leading, spacing: 2) {
                        Text(entry.username).fontWeight(.semibold)
                        Text("\(entry.wins) wins · \(entry.gamesPlayed) games")
                            .font(.caption).foregroundColor(.secondary)
                    }

                    Spacer()

                    VStack(alignment: .trailing) {
                        Text("\(entry.totalScore)").fontWeight(.black).monospacedDigit()
                        Text("avg \(Int(entry.avgScore))").font(.caption2).foregroundColor(.secondary)
                    }
                }
                .padding(.vertical, 4)
            }
            .listStyle(.plain)
            .navigationTitle("Leaderboard")
            .refreshable { await lbVM.load() }
        }
        .task { await lbVM.load() }
    }

    private func medalColor(_ rank: Int) -> Color {
        switch rank { case 1: .yellow; case 2: .gray; case 3: .orange; default: .secondary }
    }
}
