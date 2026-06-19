import SwiftUI

struct MainTabView: View {
    var body: some View {
        TabView {
            LobbyView()
                .tabItem { Label("Lobby", systemImage: "house.fill") }

            LeaderboardView()
                .tabItem { Label("Leaderboard", systemImage: "trophy.fill") }

            ProfileView()
                .tabItem { Label("Profile", systemImage: "person.fill") }

            SettingsView()
                .tabItem { Label("Settings", systemImage: "gearshape.fill") }
        }
        .tint(.indigo)
    }
}
