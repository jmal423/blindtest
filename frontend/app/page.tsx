import Link from "next/link";

export default function Home() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 gap-12">
      <div className="text-center max-w-md">
        <h2 className="text-4xl font-bold mb-4">
          Guess the <span className="text-[var(--primary)]">Song</span>
        </h2>
        <p className="text-zinc-400 text-lg">
          Listen to music clips, guess the song, and compete with your friends!
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
        <Link
          href="/create"
          className="flex-1 px-8 py-4 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-center font-semibold rounded-xl transition-colors"
        >
          Create Room
        </Link>
        <Link
          href="/join"
          className="flex-1 px-8 py-4 bg-[var(--surface)] hover:bg-[var(--surface-light)] text-white text-center font-semibold rounded-xl border border-white/10 transition-colors"
        >
          Join Room
        </Link>
      </div>

      <div className="flex gap-4 text-sm">
        <Link href="/login" className="text-zinc-500 hover:text-zinc-300 transition-colors">
          Account
        </Link>
        <Link href="/leaderboard" className="text-zinc-500 hover:text-zinc-300 transition-colors">
          Leaderboard
        </Link>
      </div>
    </div>
  );
}
