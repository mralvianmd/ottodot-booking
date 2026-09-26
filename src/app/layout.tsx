import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ottodot Trial Booking",
  description: "Book a trial class at Ottodot — online science & math for kids",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-white dark:bg-zinc-950">
        <ThemeProvider>
          <header className="border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">
            <nav className="mx-auto flex max-w-4xl items-center justify-between">
              <Link
                href="/"
                className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100"
              >
                Ottodot Booking
              </Link>
              <div className="flex items-center gap-4 text-sm font-medium">
                <Link
                  href="/booking"
                  className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  Book Trial
                </Link>
                <Link
                  href="/admin/roster"
                  className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  Admin Roster
                </Link>
                <ThemeToggle />
              </div>
            </nav>
          </header>
          <main className="flex-1">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
