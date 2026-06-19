import SwiftUI

struct LobbyView: View {
    @EnvironmentObject var lobbyVM: LobbyViewModel
    @EnvironmentObject var gameVM: GameViewModel
    @EnvironmentObject var authVM: AuthViewModel
    @EnvironmentObject var socket: SocketService
    @State private var joinCode = ""
    @State private var showCreate = false
    @State private var navigateToGame = false
    @State private var showOnboarding = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                Text("BlindTest")
                    .font(.largeTitle.weight(.black))

                if let user = authVM.user {
                    Text("Welcome, \(user.username)")
                        .font(.headline).foregroundColor(.secondary)
                }

                // Join
                VStack(spacing: 12) {
                    TextField("Enter room code", text: $joinCode)
                        .textFieldStyle(.roundedBorder)
                        .textCase(.uppercase)
                        .autocapitalization(.allCharacters)
                        .disableAutocorrection(true)

                    Button(action: joinAction) {
                        Label("Join Room", systemImage: "arrow.right")
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                            .background(Color.indigo)
                            .foregroundColor(.white)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                }
                .padding(.horizontal, 32)

                Button(action: { showCreate = true }) {
                    Label("Create Room", systemImage: "plus")
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(Color.green)
                        .foregroundColor(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .padding(.horizontal, 32)

                if lobbyVM.isLoading { ProgressView() }
                if let e = lobbyVM.error { Text(e).foregroundColor(.red).font(.caption) }

                Spacer()
            }
            .padding(.top, 40)
            .navigationDestination(isPresented: $navigateToGame) {
                WaitingRoomView()
            }
            .sheet(isPresented: $showCreate) {
                CreateRoomView()
            }
            .sheet(isPresented: $showOnboarding) {
                OnboardingView()
            }
        }
        .onAppear { Task { await lobbyVM.loadGenres() } }
        .onChange(of: lobbyVM.createdCode) { _, _ in navigateToGame = true }
    }

    private func joinAction() {
        Task {
            if let pid = await lobbyVM.joinRoom(code: joinCode) {
                guard let code = lobbyVM.createdCode else { return }
                gameVM.joinRoom(code: code, playerId: pid)
            }
        }
    }
}

struct CreateRoomView: View {
    @EnvironmentObject var lobbyVM: LobbyViewModel
    @EnvironmentObject var gameVM: GameViewModel
    @Environment(\.dismiss) var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section("Quick Start") {
                    Button("Create Random Room") {
                        Task {
                            if let code = await lobbyVM.createRoom() {
                                gameVM.joinRoom(code: code, playerId: "")
                                dismiss()
                            }
                        }
                    }
                }
            }
            .navigationTitle("New Room")
        }
    }
}

struct OnboardingView: View {
    @Environment(\.dismiss) var dismiss

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                Text("Welcome to BlindTest!")
                    .font(.title.weight(.black))
                Text("Guess the artist and song title from short music clips. First to find both wins!")
                    .multilineTextAlignment(.center)
                    .foregroundColor(.secondary)
                Spacer()
                Button("Get Started") { dismiss() }
                    .buttonStyle(.borderedProminent)
            }
            .padding()
            .navigationTitle("How to Play")
        }
    }
}
