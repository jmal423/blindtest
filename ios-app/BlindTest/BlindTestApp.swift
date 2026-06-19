import SwiftUI

@main
struct BlindTestApp: App {
    @StateObject private var authVM = AuthViewModel()
    @StateObject private var lobbyVM = LobbyViewModel()
    @StateObject private var gameVM = GameViewModel()
    @StateObject private var lbVM = LeaderboardViewModel()
    @StateObject private var profileVM = ProfileViewModel()
    @StateObject private var socket = SocketService.shared
    @StateObject private var audio = AudioService.shared

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(authVM)
                .environmentObject(lobbyVM)
                .environmentObject(gameVM)
                .environmentObject(lbVM)
                .environmentObject(profileVM)
                .environmentObject(socket)
                .environmentObject(audio)
                .task { await authVM.initialize() }
        }
    }
}
