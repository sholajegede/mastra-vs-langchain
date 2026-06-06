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
  title: "Mastra vs LangChain",
  description:
    "The same 5-step research pipeline. Two frameworks. Every token, every step, every decision — visible.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#0d1117] text-[#e6edf3]">
        <ConvexClientProvider>
          <header className="border-b border-[#21262d] bg-[#161b22]">
            <nav className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
              <Link
                href="/"
                className="text-sm font-semibold text-white hover:text-[#e6edf3]"
              >
                Mastra vs LangChain
              </Link>
              <div className="flex items-center gap-4 text-sm text-[#8b949e]">
                <Link
                  href="/"
                  className="hover:text-[#e6edf3] transition-colors"
                >
                  Run
                </Link>
                <Link
                  href="/history"
                  className="hover:text-[#e6edf3] transition-colors"
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
