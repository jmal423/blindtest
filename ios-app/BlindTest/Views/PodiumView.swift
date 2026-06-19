import SwiftUI

struct PodiumView: View {
    @EnvironmentObject var gameVM: GameViewModel
    @EnvironmentObject var socket: SocketService

    var body: some View {
        VStack(spacing: 24) {
            Text("Game Over!")
                .font(.largeTitle.weight(.black))

            let top3 = gameVM.rankings.prefix(3)
            HStack(alignment: .bottom, spacing: 16) {
                ForEach(top3) { entry in
                    VStack(spacing: 8) {
                        Text("#\(entry.rank)")
                            .font(.title3.weight(.black))
                            .foregroundColor(medalColor(entry.rank))
                        Text(entry.name).font(.headline)
                        Text("\(entry.score)")
                            .font(.title2.weight(.black))
                        Text("XP: \(entry.xp)").font(.caption)
                    }
                    .padding()
                    .background(
                        RoundedRectangle(cornerRadius: 16)
                            .fill(Color(.systemGray6))
                    )
                    .padding(.top, entry.rank == 1 ? 0 : 20)
                }
            }

            List(gameVM.rankings) { entry in
                HStack {
                    Text("#\(entry.rank)").fontWeight(.bold).frame(width: 40)
                    Text(entry.name)
                    Spacer()
                    Text("\(entry.score)").fontWeight(.bold).monospacedDigit()
                }
            }
            .listStyle(.plain)

            Button(action: { gameVM.playAgain() }) {
                Label("Play Again", systemImage: "arrow.counterclockwise")
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                    .background(Color.indigo)
                    .foregroundColor(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 16))
            }
            .padding(.horizontal, 32)
        }
        .padding()
        .onReceive(socket.$gameState) { state in
            if let s = state, s.state == "waiting" {
                gameVM.handleGameState(s)
            }
        }
    }

    private func medalColor(_ rank: Int) -> Color {
        switch rank { case 1: .yellow; case 2: .secondary; case 3: .orange; default: .primary }
    }
}
