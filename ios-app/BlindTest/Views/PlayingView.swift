import SwiftUI

struct PlayingView: View {
    @EnvironmentObject var gameVM: GameViewModel
    @EnvironmentObject var socket: SocketService
    @EnvironmentObject var audio: AudioService
    @Environment(\.dismiss) var dismiss
    @State private var showSkipReason = false
    @State private var navigateToPodium = false
    @State private var navigateToResult = false

    var body: some View {
        VStack(spacing: 0) {
            // Top bar
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Round \(gameVM.currentRound)/\(gameVM.totalRounds)")
                        .font(.caption.weight(.bold)).foregroundColor(.secondary)
                    if let artist = gameVM.trackArtist {
                        Text(artist).font(.caption2).foregroundColor(.secondary)
                    }
                }
                Spacer()
                if let tl = gameVM.timeLeft {
                    HStack(spacing: 4) {
                        Image(systemName: "clock.fill").font(.caption)
                        Text("\(tl)s").font(.title3.weight(.black).monospacedDigit())
                    }
                }
            }
            .padding(.horizontal).padding(.top, 8)

            // Progress bar - smooth 60fps
            SmoothTimerBar(timeLeft: gameVM.timeLeft ?? 0, totalTime: 15, smoothTime: gameVM.smoothTime)
                .frame(height: 8).padding(.horizontal).padding(.bottom, 8)

            // Player markers with avatars
            ScrollView(.horizontal) {
                HStack(spacing: 8) {
                    ForEach(gameVM.players) { player in
                        VStack(spacing: 2) {
                            if let url = player.avatarUrl.flatMap({ URL(string: $0) }) {
                                AsyncImage(url: url) { phase in
                                    if let image = phase.image {
                                        image.resizable().scaledToFill()
                                    } else {
                                        Circle().fill(Color.gray.opacity(0.3))
                                    }
                                }
                                .frame(width: 32, height: 32).clipShape(Circle())
                            } else {
                                Circle()
                                    .fill(playerColor(player.id))
                                    .frame(width: 32, height: 32)
                                    .overlay(Text(player.name.prefix(1)).font(.caption2.weight(.bold)).foregroundColor(.white))
                            }
                            Text(player.name).font(.system(size: 8)).fontWeight(.bold).lineLimit(1)
                            if player.foundBoth == true {
                                Text("BOTH").font(.system(size: 6, weight: .black)).foregroundColor(.green)
                            } else if player.foundArtist == true {
                                Text("ARTIST").font(.system(size: 6, weight: .black)).foregroundColor(.orange)
                            } else if player.foundTitle == true {
                                Text("TITLE").font(.system(size: 6, weight: .black)).foregroundColor(.blue)
                            }
                        }
                        .frame(width: 56)
                    }
                }
                .padding(.horizontal)
            }
            .frame(height: 70)

            // Guess input
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
            .padding(.horizontal).padding(.top, 8)

            // Guess result feedback
            if let r = gameVM.guessResult {
                VStack(spacing: 6) {
                    HStack {
                        Image(systemName: r.foundBoth ? "checkmark.circle.fill" : "xmark.circle.fill")
                            .foregroundColor(r.foundBoth ? .green : .red)
                        Text(r.foundBoth ? "Correct!" : "Keep guessing")
                            .font(.headline.weight(.black))
                    }
                    if !r.foundBoth {
                        VStack(spacing: 2) {
                            HStack {
                                Text("Artist:").foregroundColor(.secondary)
                                Text(r.artistResult).fontWeight(.bold)
                                Spacer()
                                Text("\(r.artistScore)%").fontWeight(.black).monospacedDigit()
                            }
                            HStack {
                                Text("Title:").foregroundColor(.secondary)
                                Text(r.titleResult).fontWeight(.bold)
                                Spacer()
                                Text("\(r.titleScore)%").fontWeight(.black).monospacedDigit()
                            }
                        }
                        .font(.caption)
                    }
                    if r.foundBoth, let ms = r.guessTimeMs {
                        Text("Guessed in \(String(format: "%.1f", Double(ms)/1000))s")
                            .font(.caption2).foregroundColor(.secondary)
                    }
                }
                .padding(12)
                .background(Color(.systemGray6))
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .padding(.horizontal)
            }

            // Skip button
            Button(action: { showSkipReason = true }) {
                Label("Skip Round", systemImage: "forward.fill")
                    .font(.caption.weight(.bold))
                    .padding(.horizontal, 16).padding(.vertical, 10)
                    .background(Color.orange.opacity(0.15))
                    .foregroundColor(.orange)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
            }
            .disabled(gameVM.hasVotedSkip)
            .padding(.top, 4)

            Spacer()
        }
        .navigationBarBackButtonHidden(true)
        .navigationDestination(isPresented: $navigateToResult) {
            RoundResultView()
        }
        .navigationDestination(isPresented: $navigateToPodium) {
            PodiumView()
        }
        .confirmationDialog("Skip this round?", isPresented: $showSkipReason, titleVisibility: .visible) {
            Button("Wrong song") { gameVM.skipRound() }
            Button("Bad audio") { gameVM.skipRound() }
            Button("Not playing") { gameVM.skipRound() }
            Button("Just skip") { gameVM.skipRound() }
            Button("Cancel", role: .cancel) {}
        }
        .onReceive(socket.$guessResult) { r in
            if let r = r { gameVM.handleGuessResult(r) }
        }
        .onReceive(socket.$gameState) { state in
            if let s = state {
                gameVM.handleGameState(s)
                handleAudio(state: s)
            }
        }
        .onChange(of: gameVM.phase) { _, phase in
            if phase == .roundResult { navigateToResult = true }
            if phase == .gameOver { navigateToPodium = true }
        }
    }

    private func handleAudio(state: GameState) {
        if state.state == "round_preparing" || state.state == "playing" {
            if let url = state.previewUrl.flatMap({ URL(string: $0) }) {
                audio.play(url: url)
            }
        }
        if state.state == "round_result" || state.state == "game_over" {
            audio.stop()
        }
    }

    private func playerColor(_ id: String) -> Color {
        let colors: [Color] = [.indigo, .green, .orange, .red, .pink, .cyan, .purple, .yellow]
        return colors[abs(id.hashValue) % colors.count]
    }
}

struct SmoothTimerBar: View {
    let timeLeft: Int
    let totalTime: Int
    let smoothTime: Double

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                RoundedRectangle(cornerRadius: 4)
                    .fill(Color.gray.opacity(0.15))
                RoundedRectangle(cornerRadius: 4)
                    .fill(timeLeft > 5 ? Color.indigo : Color.red)
                    .frame(width: max(0, (CGFloat(totalTime - Int(smoothTime)) / CGFloat(totalTime)) * geo.size.width))
                    .animation(.linear(duration: 0.016), value: smoothTime)
            }
        }
    }
}
