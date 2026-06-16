import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy - BlindTest",
};

export default function PrivacyPage() {
  return (
    <div className="flex-1 overflow-y-auto">
    <div className="max-w-2xl mx-auto px-4 py-12 text-sm text-foreground/80 space-y-6">
      <h1 className="text-2xl font-black text-foreground">Privacy Policy</h1>

      <section>
        <h2 className="text-lg font-bold text-foreground mt-6 mb-2">1. Information We Collect</h2>
        <p>We collect the following information through Discord OAuth2:</p>
        <ul className="list-disc pl-6 space-y-1 mt-2">
          <li>Discord user ID</li>
          <li>Username</li>
          <li>Avatar URL</li>
        </ul>
        <p className="mt-2">We also store game-related data such as scores, round results, and room participation history.</p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-foreground mt-6 mb-2">2. How We Use Information</h2>
        <p>Your information is used solely to:</p>
        <ul className="list-disc pl-6 space-y-1 mt-2">
          <li>Authenticate you via Discord</li>
          <li>Track game scores and leaderboards</li>
          <li>Display your profile and game history</li>
          <li>Provide admin functionality for server management</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-bold text-foreground mt-6 mb-2">3. Data Storage</h2>
        <p>Data is stored in a PostgreSQL database on a private server. We do not sell, share, or transmit your data to third parties except as required for the Deezer API integration (Deezer's privacy policy applies to their service).</p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-foreground mt-6 mb-2">4. Data Retention</h2>
        <p>Your account data is retained until you request deletion. Game history is retained for leaderboard integrity. Contact the server administrator to request data deletion.</p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-foreground mt-6 mb-2">5. Cookies</h2>
        <p>We use localStorage for authentication tokens and user preferences. No third-party cookies are used.</p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-foreground mt-6 mb-2">6. Third-Party Services</h2>
        <p>This service uses:</p>
        <ul className="list-disc pl-6 space-y-1 mt-2">
          <li><strong>Discord</strong> — Authentication (see Discord's privacy policy)</li>
          <li><strong>Deezer</strong> — Music preview clips (see Deezer's privacy policy)</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-bold text-foreground mt-6 mb-2">7. Changes to This Policy</h2>
        <p>We may update this policy. Continued use after changes constitutes acceptance of the updated policy.</p>
      </section>
    </div>
    </div>
  );
}
