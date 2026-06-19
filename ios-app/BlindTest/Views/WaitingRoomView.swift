import SwiftUI

struct WaitingRoomView: View {
    @EnvironmentObject var gameVM: GameViewModel
    @EnvironmentObject var socket: SocketService
    @Environment(\.dismiss) var dismiss
    @State private var navigateToGame = false
    @State private var showKicked = false

    var body: some View {
        VStack(spacing: 20) {
            VStack(spacing: 4) {
                Text("Room \(gameVM.roomCode ?? "—")")
                    .font(.title.weight(.black))
                HStack(spacing: 4) {
                    Circle().fill(socket.isConnected ? Color.green : Color.orange).frame(width: 8, height: 8)
                    Text(socket.isConnected ? "Connected" : "Connecting...")
                        .font(.caption).foregroundColor(.secondary)
                }
            }
            .padding(.top)

            Text("Players (\(gameVM.players.count))")
                .font(.headline)

            List(gameVM.players) { player in
                HStack {
                    Circle()
                        .fill(Color.indigo.opacity(0.3))
                        .frame(width: 36, height: 36)
                        .overlay(Text(player.name.prefix(1)).fontWeight(.bold))
                    Text(player.name).fontWeight(.semibold)
                    if player.id == gameVM.hostId {
                        Spacer()
                        Image(systemName: "crown.fill").foregroundColor(.yellow).font(.caption)
                    }
                }
            }
            .listStyle(.plain)

            Spacer()

            if gameVM.isHost {
                Button(action: startGame) {
                    Label("Start Game", systemImage: "play.fill")
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(Color.green)
                        .foregroundColor(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 16))
                }
                .padding(.horizontal, 32)
            } else {
                Text("Waiting for host to start...")
                    .foregroundColor(.secondary)
            }

            Button("Leave", role: .destructive) {
                SocketService.shared.disconnect()
                dismiss()
            }
            .padding(.bottom, 32)
        }
        .navigationBarBackButtonHidden(true)
        .navigationDestination(isPresented: $navigateToGame) {
            PlayingView()
        }
        .onReceive(socket.$gameState) { state in
            if let s = state { gameVM.handleGameState(s) }
        }
        .onChange(of: gameVM.phase) { _, phase in
            if phase != .waiting { navigateToGame = true }
        }
        .onReceive(socket.$kicked) { kicked in
            if kicked { showKicked = true; dismiss() }
        }
        .alert("Kicked", isPresented: $showKicked) {
            Button("OK") { SocketService.shared.disconnect(); dismiss() }
        } message: {
            Text("You were removed from the room.")
        }
    }

    private func startGame() {
        guard let code = gameVM.roomCode, let pid = gameVM.playerId else { return }
        Task { try? await APIClient.shared.startGame(code: code, playerId: pid) }
    }
}
