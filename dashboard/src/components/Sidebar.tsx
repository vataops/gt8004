"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";

const navItems = [
  { href: "/explorer", label: "Explorer" },
  { href: "/create", label: "Mint Agent" },
  { href: "/register", label: "Connect Agent" },
  { href: "/dashboard", label: "Dashboard" },
];

export function Navbar() {
  const { agent, walletAddress, logout } = useAuth();
  const isConnected = !!(agent || walletAddress);

  return (
    <header className="sticky top-0 z-50 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-[#1a1a1a]" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        {/* Left: Logo + Nav */}
        <div className="flex items-center gap-8">
          <Link href="/" className="text-lg font-bold tracking-tight text-[#00FFE0]">
            GT8004
          </Link>
          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-3 py-1.5 rounded-md text-sm text-zinc-400 hover:text-[#00FFE0] transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Right: Auth */}
        <div className="flex items-center gap-3">
          {isConnected ? (
            <>
              <span className="text-xs text-zinc-400 font-mono">
                {walletAddress
                  ? `${walletAddress.slice(0, 6)}\u2026${walletAddress.slice(-4)}`
                  : agent
                    ? agent.name || agent.agent_id
                    : ""}
              </span>
              <button
                onClick={logout}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Disconnect
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="px-4 py-1.5 rounded-md text-sm font-medium bg-[#00FFE0] text-black hover:shadow-[0_0_20px_rgba(0,255,224,0.4)] transition-all"
              >
                Connect Wallet
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

// Keep backward compat export
export { Navbar as Sidebar };
