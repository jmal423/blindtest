import Foundation
import AVFoundation
import MediaPlayer

final class AudioService: ObservableObject {
    static let shared = AudioService()

    private var player: AVPlayer?
    @Published var isPlaying = false
    @Published var currentVolume: Float = 0.5 {
        didSet { player?.volume = currentVolume }
    }

    init() {
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
        try? AVAudioSession.sharedInstance().setActive(true)
        setupRemoteCommands()
    }

    private func setupRemoteCommands() {
        let cmd = MPRemoteCommandCenter.shared()
        cmd.playCommand.addTarget { [weak self] _ in
            self?.player?.play()
            self?.isPlaying = true
            return .success
        }
        cmd.pauseCommand.addTarget { [weak self] _ in
            self?.player?.pause()
            self?.isPlaying = false
            return .success
        }
    }

    func play(url: URL) {
        stop()
        player = AVPlayer(url: url)
        player?.volume = currentVolume
        player?.play()
        isPlaying = true
    }

    func playPreview(trackId: String) {
        let s = "https://blindtest.jl423.xyz/api/proxy/audio/\(trackId)"
        guard let url = URL(string: s) else { return }
        play(url: url)
    }

    func stop() {
        player?.pause()
        player = nil
        isPlaying = false
    }
}
