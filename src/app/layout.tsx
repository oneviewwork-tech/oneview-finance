import type { Metadata } from "next";
import { Geist, Geist_Mono, Fredoka } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Rounded geometric display face for the "Haris&Co." wordmark — matches the
// letterforms of the real harisand.co brand mark, and keeps this app's
// lockup identical to ONEVIEW People's.
const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "ONEVIEW Finance",
  description: "Accounts and Finance View for Haris&Co. / ONEVIEW.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} ${fredoka.variable} antialiased`}>
        {/* Applies the stored theme before first paint so dark mode never flashes white.
            Loaded as an external file (not inline) so script-src can stay free of 'unsafe-inline'.
            beforeInteractive via next/script — not a raw <script> tag, which the App Router's
            managed <head> rejects with a DOM-nesting error. */}
        <Script src="/theme-init.js" strategy="beforeInteractive" />
        {children}
      </body>
    </html>
  );
}
