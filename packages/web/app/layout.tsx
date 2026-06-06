import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
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
  title: "Agent Showdown — Mastra vs LangChain",
  description:
    "Run the same research pipeline in both Mastra and LangChain/LangGraph. Compare results, token counts, and latency side by side.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100">
        <ConvexClientProvider>
          <header className="border-b border-zinc-800 bg-zinc-900">
            <nav className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
              <Link
                href="/"
                className="text-sm font-semibold text-zinc-100 hover:text-white"
              >
                Agent Showdown
              </Link>
              <div className="flex items-center gap-4 text-sm text-zinc-400">
                <Link href="/" className="hover:text-zinc-100 transition-colors">
                  Run
                </Link>
                <Link
                  href="/history"
                  className="hover:text-zinc-100 transition-colors"
                >
                  History
                </Link>
              </div>
            </nav>
          </header>
          <main className="flex-1">{children}</main>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
