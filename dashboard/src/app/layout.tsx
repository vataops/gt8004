import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { Navbar } from "@/components/Sidebar";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GT8004 Dashboard",
  description: "Gate 8004 — Unified Dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" style={{ colorScheme: "dark" }}>
      <head>
        <meta name="theme-color" content="#0a0a0a" />
      </head>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased bg-[#0a0a0a] text-[#ededed]`}
      >
        <AuthProvider>
          <div className="min-h-screen flex flex-col">
            <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-[#00FFE0] focus:text-black focus:rounded-md focus:text-sm focus:font-medium">
              Skip to main content
            </a>
            <Navbar />
            <main id="main-content" className="flex-1">
              <div className="max-w-7xl mx-auto px-6 py-6">{children}</div>
            </main>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
