import SwiftUI

struct LobbyView: View {
    @EnvironmentObject var lobbyVM: LobbyViewModel
    @EnvironmentObject var gameVM: GameViewModel
    @EnvironmentObject var authVM: AuthViewModel
    @EnvironmentObject var socket: SocketService
    @EnvironmentObject var audio: AudioService
    @State private var joinCode = ""
    @State private var showCreate = false
    @State private var navigateToGame = false
    @State private var showOnboarding = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    // Header
                    VStack(spacing: 8) {
                        HStack(spacing: 0) {
                            Text("Blind").font(.system(size: 40, weight: .black)).foregroundColor(.indigo)
                            Text("Test").font(.system(size: 40, weight: .black)).foregroundColor(.primary)
                        }
                        Text("Guess the song, challenge your friends")
                            .font(.subheadline).foregroundColor(.secondary)
                    }
                    .padding(.top, 20)

                    // User card
                    if let user = authVM.user {
                        HStack(spacing: 12) {
                            if let url = user.avatarURL {
                                AsyncImage(url: url) { phase in
                                    if let image = phase.image {
                                        image.resizable().scaledToFill()
                                    } else {
                                        Circle().fill(Color.indigo.opacity(0.3))
                                    }
                                }
                                .frame(width: 44, height: 44).clipShape(Circle())
                            } else {
                                Circle()
                                    .fill(Color.indigo.opacity(0.3))
                                    .frame(width: 44, height: 44)
                                    .overlay(Text(user.username.prefix(1)).font(.title2.weight(.bold)))
                            }
                            VStack(alignment: .leading, spacing: 2) {
                                Text(user.username).font(.headline.weight(.bold))
                                if user.isAdmin {
                                    Text("ADMIN").font(.caption2.weight(.black)).foregroundColor(.orange)
                                }
                            }
                            Spacer()
                        }
                        .padding(.horizontal, 24)
                    }

                    // Join Room
                    VStack(spacing: 12) {
                        Text("Join a Room").font(.headline.weight(.bold))
                        HStack(spacing: 12) {
                            TextField("Enter room code", text: $joinCode)
                                .textFieldStyle(.roundedBorder)
                                .textCase(.uppercase)
                                .autocapitalization(.allCharacters)
                                .disableAutocorrection(true)
                            Button(action: joinAction) {
                                Image(systemName: "arrow.right.circle.fill")
                                    .font(.title2)
                                    .foregroundColor(.indigo)
                            }
                            .disabled(joinCode.trimmingCharacters(in: .whitespaces).isEmpty)
                        }
                    }
                    .padding(.horizontal, 24)

                    // Create Room
                    Button(action: { showCreate = true }) {
                        Label("Create Room", systemImage: "plus.circle.fill")
                            .font(.headline.weight(.bold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 16)
                            .background(Color.green)
                            .foregroundColor(.white)
                            .clipShape(RoundedRectangle(cornerRadius: 16))
                    }
                    .padding(.horizontal, 24)

                    if lobbyVM.isLoading {
                        ProgressView().padding()
                    }
                    if let e = lobbyVM.error {
                        Text(e).foregroundColor(.red).font(.caption).padding(.horizontal, 24)
                    }

                    Spacer(minLength: 40)
                }
            }
            .scrollDismissesKeyboard(.immediately)
            .navigationDestination(isPresented: $navigateToGame) {
                WaitingRoomView()
            }
            .sheet(isPresented: $showCreate) {
                CreateRoomView()
                    .environmentObject(lobbyVM)
                    .environmentObject(gameVM)
            }
        }
        .onAppear {
            Task { await lobbyVM.loadGenres() }
            Task { await lobbyVM.loadArtistGroups() }
        }
        .onChange(of: lobbyVM.createdCode) { _, _ in navigateToGame = true }
    }

    private func joinAction() {
        guard !joinCode.trimmingCharacters(in: .whitespaces).isEmpty else { return }
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
    @State private var gameMode: String = "genre"
    @State private var selectedGenres: Set<String> = []
    @State private var selectedArtists: Set<String> = []
    @State private var rounds: Double = 10
    @State private var roundTime: Double = 15

    var body: some View {
        NavigationStack {
            Form {
                Section("Game Mode") {
                    Picker("Mode", selection: $gameMode) {
                        Text("Genre").tag("genre")
                        Text("Artist").tag("artist")
                    }
                    .pickerStyle(.segmented)
                }

                if gameMode == "genre" {
                    Section("Genres") {
                        if lobbyVM.genreGroups.isEmpty {
                            ProgressView()
                        }
                        ForEach(lobbyVM.genreGroups) { group in
                            DisclosureGroup(group.id) {
                                let groupGenres = lobbyVM.genres.filter { $0.group == group.id }
                                ForEach(groupGenres) { genre in
                                    HStack {
                                        Text(genre.label).font(.subheadline)
                                        Spacer()
                                        if selectedGenres.contains(genre.id) {
                                            Image(systemName: "checkmark.circle.fill").foregroundColor(.indigo)
                                        }
                                    }
                                    .contentShape(Rectangle())
                                    .onTapGesture {
                                        if selectedGenres.contains(genre.id) {
                                            selectedGenres.remove(genre.id)
                                        } else {
                                            selectedGenres.insert(genre.id)
                                        }
                                    }
                                }
                            }
                        }
                    }
                } else {
                    Section("Artists") {
                        ForEach(lobbyVM.artistGroups) { group in
                            DisclosureGroup(group.name) {
                                ForEach(group.artists, id: \.self) { artist in
                                    HStack {
                                        Text(artist)
                                        Spacer()
                                        if selectedArtists.contains(artist) {
                                            Image(systemName: "checkmark.circle.fill").foregroundColor(.indigo)
                                        }
                                    }
                                    .contentShape(Rectangle())
                                    .onTapGesture {
                                        if selectedArtists.contains(artist) {
                                            selectedArtists.remove(artist)
                                        } else {
                                            selectedArtists.insert(artist)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                Section("Settings") {
                    VStack {
                        HStack {
                            Text("Rounds: \(Int(rounds))")
                            Spacer()
                        }
                        Slider(value: $rounds, in: 3...20, step: 1)
                    }
                    VStack {
                        HStack {
                            Text("Round Time: \(Int(roundTime))s")
                            Spacer()
                        }
                        Slider(value: $roundTime, in: 5...60, step: 5)
                    }
                }

                Section {
                    Button(action: createRoom) {
                        Label("Create Room", systemImage: "plus")
                            .frame(maxWidth: .infinity)
                    }
                    .disabled(gameMode == "genre" ? selectedGenres.isEmpty : selectedArtists.isEmpty)
                    .fontWeight(.bold)
                }
            }
            .navigationTitle("New Room")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }

    private func createRoom() {
        Task {
            let genres = gameMode == "genre" ? Array(selectedGenres) : nil
            let artists = gameMode == "artist" ? Array(selectedArtists) : nil
            if let result = await lobbyVM.createRoom(genres: genres, artists: artists, mode: gameMode) {
                gameVM.joinRoom(code: result.code, playerId: result.playerId)
                dismiss()
            }
        }
    }
}

struct OnboardingView: View {
    @Environment(\.dismiss) var dismiss

    var body: some View {
        NavigationStack {
            VStack(spacing: 32) {
                Image(systemName: "music.note.list")
                    .font(.system(size: 60))
                    .foregroundColor(.indigo)
                Text("Welcome to BlindTest!")
                    .font(.title.weight(.black))
                Text("Guess the artist and song title from short music clips. First to find both wins!\n\nEarn points for each correct answer and climb the leaderboard.")
                    .multilineTextAlignment(.center)
                    .foregroundColor(.secondary)
                    .padding(.horizontal)
                Spacer()
                Button("Get Started") { dismiss() }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
            }
            .padding()
            .navigationTitle("How to Play")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}
