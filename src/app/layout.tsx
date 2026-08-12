import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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

export const metadata: Metadata = {
  title: "ONEVIEW Finance",
  description: "Accounts and Finance View for HACA / ONEVIEW.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
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
