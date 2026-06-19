import SwiftUI

struct PodiumView: View {
    @EnvironmentObject var gameVM: GameViewModel
    @EnvironmentObject var socket: SocketService
    @Environment(\.dismiss) var dismiss

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                Text("Game Over!")
                    .font(.largeTitle.weight(.black))
                    .padding(.top)

                // Podium
                let top3 = gameVM.rankings.prefix(3)
                HStack(alignment: .bottom, spacing: 12) {
                    ForEach(top3) { entry in
                        VStack(spacing: 8) {
                            Image(systemName: entry.rank == 1 ? "crown.fill" : "chevron.up")
                                .font(.title2)
                                .foregroundColor(medalColor(entry.rank))

                            Text("#\(entry.rank)")
                                .font(.title3.weight(.black))
                                .foregroundColor(medalColor(entry.rank))

                            Circle()
                                .fill(Color.indigo.opacity(0.3))
                                .frame(width: 48, height: 48)
                                .overlay(Text(entry.name.prefix(1)).font(.title2.weight(.bold)))

                            Text(entry.name)
                                .font(.headline.weight(.bold))
                                .lineLimit(1)

                            Text("\(entry.score)")
                                .font(.title.weight(.black))
                                .foregroundColor(medalColor(entry.rank))

                            Text("XP: \(entry.xp)")
                                .font(.caption).foregroundColor(.secondary)
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(
                            RoundedRectangle(cornerRadius: 20)
                                .fill(Color(.systemGray6))
                                .shadow(color: medalColor(entry.rank).opacity(0.3), radius: 8, y: 4)
                        )
                        .padding(.top, entry.rank == 1 ? 0 : 24)
                    }
                }
                .padding(.horizontal)

                // All players
                VStack(alignment: .leading, spacing: 8) {
                    Text("Full Rankings")
                        .font(.headline.weight(.bold))
                        .padding(.horizontal)

                    ForEach(gameVM.rankings) { entry in
                        HStack {
                            Text("#\(entry.rank)")
                                .fontWeight(.bold)
                                .frame(width: 36)
                                .foregroundColor(medalColor(entry.rank))
                            Text(entry.name)
                            Spacer()
                            Text("\(entry.score)")
                                .fontWeight(.bold).monospacedDigit()
                            Text("· \(entry.xp) XP")
                                .font(.caption).foregroundColor(.secondary)
                        }
                        .padding(.horizontal)
                        .padding(.vertical, 6)
                        .background(
                            entry.rank == 1 ? Color.yellow.opacity(0.08) : Color.clear
                        )
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                }
                .padding(.horizontal)

                // Play Again
                Button(action: { gameVM.playAgain() }) {
                    Label("Play Again", systemImage: "arrow.counterclockwise")
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(Color.indigo)
                        .foregroundColor(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 16))
                }
                .padding(.horizontal, 32)
                .padding(.bottom, 32)
            }
        }
        .onReceive(socket.$gameState) { state in
            if let s = state, s.state == "waiting" {
                gameVM.handleGameState(s)
            }
        }
    }

    private func medalColor(_ rank: Int) -> Color {
        switch rank {
        case 1: return .yellow
        case 2: return .secondary
        case 3: return .orange
        default: return .primary
        }
    }
}
