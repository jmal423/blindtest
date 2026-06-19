import Foundation

@MainActor
final class LobbyViewModel: ObservableObject {
    @Published var genres: [Genre] = []
    @Published var genreGroups: [GenreGroup] = []
    @Published var artistGroups: [ArtistGroup] = []
    @Published var isLoading = false
    @Published var error: String?
    @Published var createdCode: String?
    @Published var joinedPlayerId: String?

    func loadGenres() async {
        do {
            let r = try await APIClient.shared.fetchGenres()
            genres = r.genres
            genreGroups = r.groups
        } catch {
            self.error = "Failed to load genres"
        }
    }

    func loadArtistGroups() async {
        do {
            artistGroups = try await APIClient.shared.fetchArtistGroups()
        } catch {
            self.error = "Failed to load artists"
        }
    }

    func createRoom(genres g: [String]? = nil, artists a: [String]? = nil, mode: String = "genre") async -> String? {
        isLoading = true
        defer { isLoading = false; error = nil }
        do {
            let r = try await APIClient.shared.createRoom(genres: g, artists: a, gameMode: mode)
            createdCode = r.code
            return r.code
        } catch {
            self.error = "Failed to create room"
            return nil
        }
    }

    func joinRoom(code: String) async -> String? {
        isLoading = true
        defer { isLoading = false; error = nil }
        do {
            let r = try await APIClient.shared.joinRoom(code: code.uppercased())
            joinedPlayerId = r.playerId
            createdCode = r.code
            return r.playerId
        } catch {
            self.error = "Room not found or full"
            return nil
        }
    }
}
