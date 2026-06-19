import SwiftUI

struct RoundResultView: View {
    @EnvironmentObject var gameVM: GameViewModel
    @EnvironmentObject var audio: AudioService
    @State private var remainingPause = 0

    var body: some View {
        VStack(spacing: 20) {
            Text("Round \(gameVM.currentRound) Results")
                .font(.title2.weight(.black))

            if let rr = gameVM.roundResult {
                VStack(spacing: 8) {
                    if let img = rr.albumImage, let url = URL(string: img) {
                        AsyncImage(url: url) { phase in
                            if let image = phase.image {
                                image.resizable().scaledToFill()
                            } else {
                                RoundedRectangle(cornerRadius: 12).fill(Color.gray.opacity(0.3))
                            }
                        }
                        .frame(width: 120, height: 120)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                    }

                    Text(rr.correctAnswer)
                        .font(.title3.weight(.bold))
                    Text(rr.artist)
                        .font(.subheadline).foregroundColor(.secondary)
                }
            }

            List(gameVM.players.sorted { $0.score > $1.score }) { player in
                HStack {
                    Text(player.name).fontWeight(.semibold)
                    Spacer()
                    Text("\(player.score)").fontWeight(.black).monospacedDigit()
                }
            }
            .listStyle(.plain)

            if let pt = gameVM.timeLeft, pt > 0 {
                Text("Next round in \(pt)s...")
                    .font(.caption).foregroundColor(.secondary)
            }

            Spacer()
        }
        .padding()
        .onAppear { startTimer() }
    }

    private func startTimer() {
        remainingPause = gameVM.timeLeft ?? 4
        Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { t in
            remainingPause -= 1
            if remainingPause <= 0 { t.invalidate() }
        }
    }
}
