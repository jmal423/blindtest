import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service - BlindTest",
};

export default function TermsPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12 text-sm text-foreground/80 space-y-6">
      <h1 className="text-2xl font-black text-foreground">Terms of Service</h1>

      <section>
        <h2 className="text-lg font-bold text-foreground mt-6 mb-2">1. Acceptance of Terms</h2>
        <p>By accessing or using BlindTest, you agree to be bound by these Terms of Service. If you do not agree, do not use the service.</p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-foreground mt-6 mb-2">2. Description of Service</h2>
        <p>BlindTest is a multiplayer music guessing game. Users join rooms, listen to short audio clips, and guess the song title and artist. The service uses the Deezer API to provide 30-second preview clips.</p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-foreground mt-6 mb-2">3. User Accounts</h2>
        <p>Users authenticate via Discord OAuth2. You are responsible for maintaining the confidentiality of your account. You must be at least 13 years old to use this service.</p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-foreground mt-6 mb-2">4. Acceptable Use</h2>
        <p>You agree not to:</p>
        <ul className="list-disc pl-6 space-y-1 mt-2">
          <li>Use the service for any illegal purpose</li>
          <li>Attempt to disrupt or compromise the service</li>
          <li>Impersonate other users</li>
          <li>Use automated tools to manipulate gameplay</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-bold text-foreground mt-6 mb-2">5. Limitation of Liability</h2>
        <p>BlindTest is provided "as is" without warranties of any kind. We are not liable for any damages arising from your use of the service.</p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-foreground mt-6 mb-2">6. Changes to Terms</h2>
        <p>We reserve the right to modify these terms at any time. Continued use after changes constitutes acceptance of the new terms.</p>
      </section>

      <section>
        <h2 className="text-lg font-bold text-foreground mt-6 mb-2">7. Contact</h2>
        <p>For questions about these terms, contact the server administrator.</p>
      </section>
    </div>
  );
}
