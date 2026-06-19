import Foundation

struct Genre: Codable, Identifiable {
    let id: String
    let label: String
    let group: String?
}

struct GenreGroup: Codable, Identifiable {
    let id: String
    let genreIds: [String]
}

struct GenreResponse: Codable {
    let genres: [Genre]
    let groups: [GenreGroup]
}

struct ArtistGroup: Codable, Identifiable {
    let id: String
    let name: String
    let artists: [String]
}
