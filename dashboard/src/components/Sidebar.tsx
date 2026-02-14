"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";

const publicNav = [
  { href: "/", label: "Explorer" },
  { href: "/create", label: "Create Agent" },
];

const privateNav = [
  { href: "/my-agents", label: "Dashboard" },
];

export function Sidebar() {
  const { agent, walletAddress, logout } = useAuth();
  const isConnected = !!(agent || walletAddress);

  return (
    <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col">
      <div className="p-4 border-b border-gray-800">
        <h1 className="text-lg font-bold tracking-tight">GT8004</h1>
      </div>
      <nav className="flex-1 p-2 space-y-1 overflow-auto">
        <p className="px-3 pt-2 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Network
        </p>
        {publicNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="block px-3 py-2 rounded-md text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
          >
            {item.label}
          </Link>
        ))}

        {isConnected ? (
          <>
            <p className="px-3 pt-4 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              My Agents
            </p>
            {privateNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block px-3 py-2 rounded-md text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </>
        ) : (
          <>
            <Link
              href="/register"
              className="block px-3 py-2 mt-4 rounded-md text-sm text-green-400 hover:bg-gray-800 hover:text-green-300 transition-colors"
            >
              Register Agent
            </Link>
            <Link
              href="/login"
              className="block px-3 py-2 rounded-md text-sm text-blue-400 hover:bg-gray-800 hover:text-blue-300 transition-colors"
            >
              Login
            </Link>
          </>
        )}
      </nav>
      <div className="p-4 border-t border-gray-800">
        {isConnected ? (
          <div>
            <p className="text-xs text-gray-400 truncate">
              {agent
                ? agent.name || agent.agent_id
                : walletAddress
                  ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
                  : ""}
            </p>
            <button
              onClick={logout}
              className="text-xs text-gray-600 hover:text-gray-400 mt-1 transition-colors"
            >
              Logout
            </button>
          </div>
        ) : (
          <p className="text-xs text-gray-600">v1.0</p>
        )}
      </div>
    </aside>
  );
}
