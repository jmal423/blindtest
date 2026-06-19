import SwiftUI

struct PlayingView: View {
    @EnvironmentObject var gameVM: GameViewModel
    @EnvironmentObject var socket: SocketService
    @EnvironmentObject var audio: AudioService
    @Environment(\.dismiss) var dismiss

    var body: some View {
        VStack(spacing: 0) {
            // Top bar
            HStack {
                Text("Round \(gameVM.currentRound)/\(gameVM.totalRounds)")
                    .font(.caption.weight(.bold)).foregroundColor(.secondary)
                Spacer()
                if let tl = gameVM.timeLeft {
                    Text("\(tl)s").font(.title3.weight(.black).monospacedDigit())
                }
            }
            .padding(.horizontal).padding(.top, 8)

            // Progress bar
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 4).fill(Color.gray.opacity(0.2)).frame(height: 8)
                    RoundedRectangle(cornerRadius: 4)
                        .fill((gameVM.timeLeft ?? 0) > 5 ? Color.indigo : Color.red)
                        .frame(width: progressWidth(total: geo.size.width), height: 8)
                        .animation(.linear(duration: 0.05), value: gameVM.smoothTime)
                }
            }
            .frame(height: 8).padding(.horizontal).padding(.bottom, 8)

            // Player markers
            ScrollView(.horizontal) {
                HStack(spacing: 8) {
                    ForEach(gameVM.players) { player in
                        VStack(spacing: 2) {
                            Circle()
                                .fill(playerColor(player.id))
                                .frame(width: 28, height: 28)
                                .overlay(Text(player.name.prefix(1)).font(.caption2.weight(.bold)).foregroundColor(.white))
                            Text(player.name).font(.system(size: 8)).fontWeight(.bold)
                            if player.foundBoth == true {
                                Text("BOTH").font(.system(size: 6)).weight(.black).foregroundColor(.green)
                            } else if player.foundArtist == true {
                                Text("ARTIST").font(.system(size: 6)).weight(.black).foregroundColor(.orange)
                            } else if player.foundTitle == true {
                                Text("TITLE").font(.system(size: 6)).weight(.black).foregroundColor(.blue)
                            }
                        }
                        .frame(width: 56)
                    }
                }
                .padding(.horizontal)
            }
            .frame(height: 60)

            // Guess
            VStack(spacing: 12) {
                TextField("Type your guess...", text: $gameVM.guess)
                    .textFieldStyle(.roundedBorder)
                    .disableAutocorrection(true)
                    .disabled(gameVM.bothFound)
                    .onSubmit { gameVM.submitGuess() }

                Button(action: { gameVM.submitGuess() }) {
                    Text("Guess")
                        .fontWeight(.bold)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(gameVM.bothFound ? Color.gray : Color.indigo)
                        .foregroundColor(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .disabled(gameVM.bothFound)
            }
            .padding(.horizontal).padding(.top, 12)

            // Result feedback
            if let r = gameVM.guessResult {
                VStack(spacing: 4) {
                    Text(r.foundBoth ? "✅ Correct!" : "❌ Keep guessing")
                        .font(.headline.weight(.black))
                    if !r.foundBoth {
                        Text("Artist: \(r.artistResult) (\(r.artistScore)%)").font(.caption)
                        Text("Title: \(r.titleResult) (\(r.titleScore)%)").font(.caption)
                    }
                }
                .padding(8)
                .background(Color(.systemGray6))
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .padding(.horizontal)
            }

            // Skip
            Button(action: { gameVM.skipRound() }) {
                Label("Skip", systemImage: "forward.fill")
                    .font(.caption.weight(.bold))
                    .padding(.horizontal, 16).padding(.vertical, 8)
                    .background(Color.orange.opacity(0.2))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
            }
            .disabled(gameVM.hasVotedSkip)
            .padding(.top, 8)

            Spacer()
        }
        .navigationBarBackButtonHidden(true)
        .onReceive(socket.$guessResult) { r in
            if let r = r { gameVM.handleGuessResult(r) }
        }
        .onReceive(socket.$gameState) { state in
            if let s = state { gameVM.handleGameState(s) }
        }
        .onChange(of: gameVM.phase) { phase in
            if phase == .gameOver { /* will navigate via state */ }
        }
        .onChange(of: gameVM.phase) { phase in
            if phase == .roundResult { startAnnouncementTimer() }
        }
    }

    private func startAnnouncementTimer() {
        Task {
            try? await Task.sleep(nanoseconds: UInt64((gameVM.timeLeft ?? 4) * 1_000_000_000))
        }
    }

    private func progressWidth(total: CGFloat) -> CGFloat {
        guard let tl = gameVM.timeLeft else { return total }
        return CGFloat(max(0, Double(tl) / 15.0)) * total
    }

    private func playerColor(_ id: String) -> Color {
        let colors: [Color] = [.indigo, .green, .orange, .red, .pink, .cyan, .purple, .yellow]
        return colors[abs(id.hashValue) % colors.count]
    }
}
