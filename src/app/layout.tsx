import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navigation from "@/components/Navigation";
import AuthProvider from "@/components/AuthProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Klub Strzelecki - Portal",
  description: "Portal klubu strzeleckiego — kalendarz, rankingi, wyniki, zapisy na zawody",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pl"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <Navigation />
          <main className="flex-1">{children}</main>
          <footer className="bg-card border-t border-border py-6">
            <div className="max-w-7xl mx-auto px-4 text-center text-sm text-muted">
              &copy; 2026 Klub Strzelecki. Wszelkie prawa zastrzeżone.
            </div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
