import SwiftUI

struct ContentView: View {
    @EnvironmentObject var authVM: AuthViewModel

    var body: some View {
        Group {
            if authVM.isLoading {
                LoadingView()
            } else if authVM.isLoggedIn {
                MainTabView()
                    .onAppear { SocketService.shared.connect() }
                    .onDisappear { SocketService.shared.disconnect() }
            } else {
                LoginView()
            }
        }
    }
}

struct LoadingView: View {
    var body: some View {
        VStack(spacing: 16) {
            ProgressView().scaleEffect(1.5)
            Text("Loading...").font(.caption).foregroundColor(.secondary)
        }
    }
}
