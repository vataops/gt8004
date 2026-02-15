"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";

const navItems = [
  { href: "/explorer", label: "Explorer" },
  { href: "/create", label: "Create Agent" },
];

export function Navbar() {
  const { agent, walletAddress, logout } = useAuth();
  const isConnected = !!(agent || walletAddress);

  return (
    <header className="sticky top-0 z-50 bg-gray-950/80 backdrop-blur-md border-b border-gray-800/50">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        {/* Left: Logo + Nav */}
        <div className="flex items-center gap-8">
          <Link href="/" className="text-lg font-bold tracking-tight">
            GT8004
          </Link>
          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-3 py-1.5 rounded-md text-sm text-gray-400 hover:text-white hover:bg-gray-800/50 transition-colors"
              >
                {item.label}
              </Link>
            ))}
            {isConnected && (
              <Link
                href="/my-agents"
                className="px-3 py-1.5 rounded-md text-sm text-gray-400 hover:text-white hover:bg-gray-800/50 transition-colors"
              >
                Dashboard
              </Link>
            )}
          </nav>
        </div>

        {/* Right: Auth */}
        <div className="flex items-center gap-3">
          {isConnected ? (
            <>
              <span className="text-xs text-gray-400 font-mono">
                {agent
                  ? agent.name || agent.agent_id
                  : walletAddress
                    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
                    : ""}
              </span>
              <button
                onClick={logout}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                href="/register"
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Register
              </Link>
              <Link
                href="/login"
                className="px-4 py-1.5 rounded-md text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors"
              >
                Login
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
