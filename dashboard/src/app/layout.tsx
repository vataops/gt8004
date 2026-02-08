import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AES Dashboard",
  description: "Agent Execution Service — Unified Dashboard",
};

const openNav = [
  { href: "/", label: "Overview" },
  { href: "/customers", label: "Customers" },
  { href: "/revenue", label: "Revenue" },
  { href: "/performance", label: "Performance" },
  { href: "/alerts", label: "Alerts" },
  { href: "/discovery", label: "Discovery" },
  { href: "/benchmark", label: "Benchmark" },
  { href: "/logs", label: "Logs" },
];

const liteNav = [
  { href: "/channels", label: "Channels" },
  { href: "/agents", label: "Agents" },
  { href: "/escrow", label: "Escrow" },
  { href: "/transactions", label: "Transactions" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-950 text-gray-100`}
      >
        <div className="flex h-screen">
          {/* Sidebar */}
          <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col">
            <div className="p-4 border-b border-gray-800">
              <h1 className="text-lg font-bold tracking-tight">AES</h1>
              <p className="text-xs text-gray-500">Unified Dashboard</p>
            </div>
            <nav className="flex-1 p-2 space-y-1 overflow-auto">
              <p className="px-3 pt-2 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">Open</p>
              {openNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block px-3 py-2 rounded-md text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
                >
                  {item.label}
                </Link>
              ))}
              <p className="px-3 pt-4 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">Lite</p>
              {liteNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block px-3 py-2 rounded-md text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="p-4 border-t border-gray-800">
              <p className="text-xs text-gray-600">v1.0</p>
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 overflow-auto">
            <div className="p-6">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
