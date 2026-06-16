import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import Header from "./components/Header";
import LanguageInitializer from "./components/LanguageInitializer";
import OnboardingTakeover from "./components/OnboardingTakeover";
import { SettingsProvider } from "./context/SettingsContext";
import { AuthProvider } from "./context/AuthContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BlindTest - Guess the Song!",
  description: "A multiplayer music guessing game",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <meta name="color-scheme" content="dark" />
      <body className="min-h-dvh flex flex-col">
        <SettingsProvider>
          <OnboardingTakeover />
          <LanguageInitializer />
          <AuthProvider>
            <Header />
            <main className="flex-1 flex flex-col">{children}</main>
            <footer className="border-t border-foreground/5 py-4 px-4 md:px-6 text-center text-[10px] text-foreground/40">
              <div className="flex items-center justify-center gap-4">
                <Link href="/terms" className="hover:text-foreground/60 transition-colors">
                  Terms of Service
                </Link>
                <Link href="/privacy" className="hover:text-foreground/60 transition-colors">
                  Privacy Policy
                </Link>
              </div>
            </footer>
          </AuthProvider>
        </SettingsProvider>
      </body>
    </html>
  );
}
