"use client";

import Link from "next/link";
import { StatCard } from "@/components/StatCard";
import { useOverview } from "@/lib/hooks";
import { NETWORK_LIST } from "@/lib/networks";

export function NetworkOverview() {
  const { data: overview, loading: overviewLoading } = useOverview();

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-xl font-bold">Dashboard</h2>
        <p className="text-sm text-zinc-500 mt-1">
          Manage and monitor your ERC-8004 agents
        </p>
      </div>

      {/* Hero CTA */}
      <div className="relative mb-8 rounded-xl border border-[#00FFE0]/20 overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#00FFE0]/8 via-transparent to-[#00FFE0]/4" />
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-[#00FFE0]/6 rounded-full blur-3xl" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-[#00FFE0]/4 rounded-full blur-3xl" />

        <div className="relative px-8 py-10 flex flex-col items-center text-center">
          {/* Icon */}
          <div className="w-16 h-16 rounded-2xl bg-[#00FFE0]/10 border border-[#00FFE0]/20 flex items-center justify-center mb-5">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00FFE0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16" />
              <path d="M3 21h18" />
              <path d="M9 7h6" />
              <path d="M9 11h6" />
              <path d="M9 15h4" />
            </svg>
          </div>

          <h3 className="text-lg font-semibold text-gray-100 mb-2">
            Connect your wallet to get started
          </h3>
          <p className="text-sm text-zinc-400 max-w-md mb-6 leading-relaxed">
            View your registered agents, track requests and revenue, monitor endpoint health, and manage your ERC-8004 tokens — all in one place.
          </p>

          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold bg-[#00FFE0] text-black hover:shadow-[0_0_30px_rgba(0,255,224,0.35)] transition-all duration-200"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" />
              <path d="M4 6v12c0 1.1.9 2 2 2h14v-4" />
              <circle cx="18" cy="16" r="2" />
            </svg>
            Connect Wallet
          </Link>

          <div className="flex items-center gap-4 mt-5 text-xs text-zinc-500">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00FFE0]/40" />
              Agent monitoring
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00FFE0]/40" />
              Revenue tracking
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00FFE0]/40" />
              Health checks
            </span>
          </div>
        </div>
      </div>

      {/* Network Stats (secondary) */}
      <div className="mb-4">
        <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">Network Stats</h3>
      </div>

      {overviewLoading ? (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-lg p-4">
              <div className="h-3 w-20 bg-[#1a1a1a] rounded animate-pulse mb-3" />
              <div className="h-6 w-16 bg-[#1a1a1a] rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <StatCard label="Registered Agents" value={overview?.total_agents?.toLocaleString() ?? "—"} />
          <StatCard label="Total Requests" value={overview?.total_requests?.toLocaleString() ?? "—"} />
          <StatCard label="Supported Networks" value={NETWORK_LIST.length} />
        </div>
      )}

    </div>
  );
}
