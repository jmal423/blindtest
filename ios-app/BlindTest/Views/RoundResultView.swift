import SwiftUI

struct RoundResultView: View {
    @EnvironmentObject var gameVM: GameViewModel
    @EnvironmentObject var socket: SocketService
    @EnvironmentObject var audio: AudioService
    @Environment(\.dismiss) var dismiss
    @State private var remainingPause = 0
    @State private var navigateToNextRound = false
    @State private var showFlagReason = false
    @State private var navigateToPodium = false

    var body: some View {
        VStack(spacing: 16) {
            // Header
            Text("Round \(gameVM.currentRound) Results")
                .font(.title2.weight(.black))

            if let rr = gameVM.roundResult {
                VStack(spacing: 10) {
                    if let img = rr.albumImage, let url = URL(string: img) {
                        AsyncImage(url: url) { phase in
                            if let image = phase.image {
                                image.resizable().scaledToFill()
                            } else {
                                RoundedRectangle(cornerRadius: 16).fill(Color.gray.opacity(0.2))
                            }
                        }
                        .frame(width: 140, height: 140)
                        .clipShape(RoundedRectangle(cornerRadius: 16))
                        .shadow(radius: 8)
                    }

                    Text(rr.correctAnswer)
                        .font(.title3.weight(.bold))
                    Text(rr.artist)
                        .font(.subheadline).foregroundColor(.secondary)
                }
            }

            // Flag button
            if let trackId = gameVM.trackId {
                Button(action: { showFlagReason = true }) {
                    Label("Flag this song", systemImage: "flag")
                        .font(.caption.weight(.bold))
                        .foregroundColor(.orange)
                }
                .confirmationDialog("Why flag this song?", isPresented: $showFlagReason) {
                    Button("Wrong genre") { socket.flagSong(songId: trackId) }
                    Button("Wrong song") { socket.flagSong(songId: trackId) }
                    Button("Audio issue") { socket.flagSong(songId: trackId) }
                    Button("Cancel", role: .cancel) {}
                }
            }

            // Scores
            List(gameVM.players.sorted { $0.score > $1.score }) { player in
                HStack {
                    Text(player.name).fontWeight(.semibold)
                    Spacer()
                    Text("\(player.score)").fontWeight(.black).monospacedDigit()
                }
            }
            .listStyle(.plain)

            if remainingPause > 0 {
                Text("Next round in \(remainingPause)s...")
                    .font(.caption).foregroundColor(.secondary)
            }

            Spacer()
        }
        .padding()
        .navigationBarBackButtonHidden(true)
        .navigationDestination(isPresented: $navigateToNextRound) {
            PlayingView()
        }
        .navigationDestination(isPresented: $navigateToPodium) {
            PodiumView()
        }
        .onReceive(socket.$gameState) { state in
            if let s = state {
                gameVM.handleGameState(s)
                if s.state == "round_preparing" || s.state == "playing" {
                    navigateToNextRound = true
                }
                if s.state == "game_over" {
                    audio.stop()
                    navigateToPodium = true
                }
            }
        }
        .onAppear {
            remainingPause = gameVM.timeLeft ?? 4
            Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { t in
                remainingPause -= 1
                if remainingPause <= 0 { t.invalidate() }
            }
        }
    }
}
