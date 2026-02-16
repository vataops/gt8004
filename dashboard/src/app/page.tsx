"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useNetworkStats, useOverview } from "@/lib/hooks";

export default function LandingPage() {
  const router = useRouter();
  const { data: stats } = useNetworkStats();
  const { data: overview } = useOverview();
  const [search, setSearch] = useState("");

  const totalAgents = stats?.total ?? 0;
  const totalRequests = overview?.total_requests ?? 0;
  const totalRevenue = overview?.total_revenue_usdc ?? 0;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      router.push(`/explorer?q=${encodeURIComponent(search.trim())}`);
    } else {
      router.push("/explorer");
    }
  };

  return (
    <div className="-mx-6 -mt-6">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden min-h-[90vh] flex items-center">
        {/* Background layers */}
        <div className="absolute inset-0 tech-grid" />
        <div className="absolute inset-0 noise-overlay" />

        {/* Animated glow orbs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div
            className="absolute -top-[200px] -left-[200px] w-[700px] h-[700px] rounded-full bg-[#00FFE0]/[0.07]"
            style={{ animation: "glow-pulse 8s ease-in-out infinite", filter: "blur(80px)" }}
          />
          <div
            className="absolute top-[30%] -right-[150px] w-[500px] h-[500px] rounded-full bg-[#00FFE0]/[0.05]"
            style={{ animation: "glow-pulse 8s ease-in-out 3s infinite", filter: "blur(60px)" }}
          />
          <div
            className="absolute -bottom-[200px] left-[30%] w-[600px] h-[600px] rounded-full bg-[#00FFE0]/[0.04]"
            style={{ animation: "glow-pulse 8s ease-in-out 5s infinite", filter: "blur(100px)" }}
          />
        </div>

        {/* Scanline effect */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.015]">
          <div
            className="absolute w-full h-[200%] bg-gradient-to-b from-transparent via-[#00FFE0] to-transparent"
            style={{ animation: "grid-scan 8s linear infinite" }}
          />
        </div>

        {/* Top gradient line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#00FFE0]/50 to-transparent" />

        {/* Corner accents */}
        <div className="absolute top-6 left-6 w-16 h-16 border-l border-t border-[#00FFE0]/20" />
        <div className="absolute top-6 right-6 w-16 h-16 border-r border-t border-[#00FFE0]/20" />
        <div className="absolute bottom-6 left-6 w-16 h-16 border-l border-b border-[#00FFE0]/10" />
        <div className="absolute bottom-6 right-6 w-16 h-16 border-r border-b border-[#00FFE0]/10" />

        <div className="relative z-10 max-w-5xl mx-auto px-6 py-24 w-full">
          {/* Status badge */}
          <div className="animate-fade-in mb-10">
            <div className="inline-flex items-center gap-3 px-5 py-2 rounded-full border border-[#00FFE0]/15 bg-[#00FFE0]/[0.03] backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00FFE0] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00FFE0]" />
              </span>
              <span className="text-xs text-zinc-400 tracking-wide">
                <span className="text-[#00FFE0] font-mono font-medium">{totalAgents.toLocaleString()}</span> agents registered on-chain
              </span>
            </div>
          </div>

          {/* Title block */}
          <div className="animate-fade-in">
            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] font-bold tracking-tight leading-[1.05]">
              <span className="block text-[#ededed]">The Dashboard</span>
              <span className="block text-[#ededed]">for{" "}
                <span
                  className="bg-gradient-to-r from-[#00FFE0] via-cyan-300 to-[#00FFE0] bg-clip-text text-transparent"
                  style={{ textShadow: "0 0 80px rgba(0, 255, 224, 0.3)" }}
                >
                  AI Agents
                </span>
              </span>
            </h1>
          </div>

          {/* Subtitle with monospace accent */}
          <div className="animate-fade-in-delay mt-8 max-w-xl">
            <p className="text-lg md:text-xl text-zinc-400 leading-relaxed">
              Explore, validate, and interact with autonomous agents
              registered on{" "}
              <span className="font-mono text-[#00FFE0]/80 text-base">ERC-8004</span>
            </p>
          </div>

          {/* Search + CTAs row */}
          <div className="animate-fade-in-delay-2 mt-12 flex flex-col sm:flex-row items-stretch sm:items-center gap-4 max-w-2xl">
            <form onSubmit={handleSearch} className="flex-1">
              <div className="relative group">
                <div className="absolute -inset-px bg-gradient-to-r from-[#00FFE0]/20 via-transparent to-[#00FFE0]/20 rounded-lg opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-500" />
                <div className="relative flex items-center bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg overflow-hidden group-focus-within:border-[#00FFE0]/30 transition-colors">
                  <svg className="w-4 h-4 text-zinc-600 ml-4 shrink-0" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    name="search"
                    placeholder="Search agents by name, address, or token ID\u2026"
                    aria-label="Search agents"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="flex-1 bg-transparent px-4 py-3.5 text-sm text-[#ededed] placeholder-zinc-600 focus:outline-none"
                  />
                </div>
              </div>
            </form>

            <div className="flex gap-3">
              <Link
                href="/explorer"
                className="group inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-[#00FFE0] text-black font-semibold rounded-lg hover:shadow-[0_0_30px_rgba(0,255,224,0.35)] transition-shadow text-sm whitespace-nowrap"
              >
                Browse Agents
                <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Link>
              <Link
                href="/create"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 text-[#00FFE0] font-semibold rounded-lg border border-[#00FFE0]/20 hover:border-[#00FFE0]/40 hover:bg-[#00FFE0]/[0.05] transition-all text-sm whitespace-nowrap"
              >
                <svg className="w-4 h-4" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Create
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[#0a0a0a] to-transparent" />
      </section>

      {/* ── Live Stats Ticker ── */}
      <section className="relative -mt-20 z-10 max-w-5xl mx-auto px-6">
        <div className="animated-border bg-[#0a0a0a]/90 backdrop-blur-md rounded-2xl">
          <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#1a1a1a]">
            <StatBlock
              label="On-chain Agents"
              value={totalAgents.toLocaleString()}
              prefix=""
            />
            <StatBlock
              label="Total Requests"
              value={totalRequests.toLocaleString()}
              prefix=""
            />
            <StatBlock
              label="Total Revenue"
              value={`$${totalRevenue.toFixed(2)}`}
              prefix=""
              suffix="USDC"
            />
          </div>
        </div>
      </section>

      {/* ── Features — Bento Grid ── */}
      <section className="max-w-5xl mx-auto px-6 pt-32 pb-20">
        <div className="mb-16">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-px flex-1 max-w-[40px] bg-[#00FFE0]/40" />
            <span className="text-xs text-[#00FFE0] uppercase tracking-[0.2em] font-medium font-mono">Platform</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Everything your agent needs
          </h2>
          <p className="mt-3 text-zinc-500 max-w-lg">
            Built-in tools for monitoring, security, and discovery. No additional setup required.
          </p>
        </div>

        {/* Bento layout: 1 large left + 2 stacked right */}
        <div className="grid md:grid-cols-5 gap-4">
          {/* Large featured card */}
          <div className="md:col-span-3 group relative overflow-hidden rounded-2xl border border-[#1a1a1a] bg-[#0f0f0f] p-8 md:p-10 transition-colors hover:border-[#00FFE0]/20">
            <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-[#00FFE0]/[0.04] rounded-full blur-[100px] transition-opacity duration-700 opacity-0 group-hover:opacity-100" />
            <div className="relative z-10">
              <div className="w-12 h-12 rounded-xl bg-[#00FFE0]/[0.08] border border-[#00FFE0]/20 flex items-center justify-center mb-6">
                <ChartIcon />
              </div>
              <h3 className="text-xl font-semibold mb-3">Free Analytics</h3>
              <p className="text-sm text-zinc-400 leading-relaxed max-w-md">
                Request logging, customer analysis, and revenue tracking.
                Zero latency overhead, zero cost. Full visibility into your
                agent&apos;s performance from day one.
              </p>
              <div className="mt-8 flex items-center gap-6">
                {["Real-time logs", "Revenue tracking", "Customer insights"].map((tag) => (
                  <span key={tag} className="text-[11px] text-zinc-600 font-mono uppercase tracking-wider">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Two stacked cards */}
          <div className="md:col-span-2 flex flex-col gap-4">
            <div className="group relative flex-1 overflow-hidden rounded-2xl border border-[#1a1a1a] bg-[#0f0f0f] p-6 transition-colors hover:border-[#00FFE0]/20">
              <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-[#00FFE0]/[0.03] rounded-full blur-[80px] transition-opacity duration-700 opacity-0 group-hover:opacity-100" />
              <div className="relative z-10">
                <div className="w-10 h-10 rounded-lg bg-[#00FFE0]/[0.08] border border-[#00FFE0]/20 flex items-center justify-center mb-4">
                  <ShieldIcon />
                </div>
                <h3 className="text-lg font-semibold mb-2">Escrow System</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  On-chain payment protection for contracts over $100.
                  Secure, transparent, and automatic.
                </p>
              </div>
            </div>

            <div className="group relative flex-1 overflow-hidden rounded-2xl border border-[#1a1a1a] bg-[#0f0f0f] p-6 transition-colors hover:border-[#00FFE0]/20">
              <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-[#00FFE0]/[0.03] rounded-full blur-[80px] transition-opacity duration-700 opacity-0 group-hover:opacity-100" />
              <div className="relative z-10">
                <div className="w-10 h-10 rounded-lg bg-[#00FFE0]/[0.08] border border-[#00FFE0]/20 flex items-center justify-center mb-4">
                  <GridIcon />
                </div>
                <h3 className="text-lg font-semibold mb-2">Agent Marketplace</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Discover, compare, and benchmark agents by reputation,
                  category, and performance.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Protocol Stats Marquee ── */}
      <section className="relative border-y border-[#1a1a1a] overflow-hidden py-4">
        <div className="flex" style={{ animation: "marquee 30s linear infinite", width: "max-content" }}>
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex items-center gap-12 px-6">
              <MarqueeItem label="Protocol" value="ERC-8004" />
              <MarqueeDot />
              <MarqueeItem label="Networks" value="Base \u00b7 Base Sepolia" />
              <MarqueeDot />
              <MarqueeItem label="Agent Standard" value="On-chain Registry" />
              <MarqueeDot />
              <MarqueeItem label="Payments" value="USDC via x402" />
              <MarqueeDot />
              <MarqueeItem label="Interop" value="A2A \u00b7 MCP" />
              <MarqueeDot />
              <MarqueeItem label="Trust" value="EAS Attestations" />
              <MarqueeDot />
            </div>
          ))}
        </div>
      </section>

      {/* ── SDK ── */}
      <SDKSection />

      {/* ── Bottom CTA ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 tech-grid opacity-50" />
        <div className="absolute inset-0 noise-overlay" />
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#00FFE0]/[0.06] rounded-full"
            style={{ filter: "blur(120px)" }}
          />
        </div>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#00FFE0]/20 to-transparent" />

        <div className="relative z-10 max-w-3xl mx-auto px-6 py-28 text-center">
          <p className="text-xs text-[#00FFE0] uppercase tracking-[0.2em] font-medium font-mono mb-4">
            Get Started
          </p>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
            Ready to go on-chain?
          </h2>
          <p className="mt-5 text-zinc-400 text-lg max-w-md mx-auto">
            Join the growing network of autonomous agents
            on the ERC-8004 registry.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              href="/explorer"
              className="group inline-flex items-center gap-2 px-8 py-3.5 bg-[#00FFE0] text-black font-semibold rounded-lg hover:shadow-[0_0_40px_rgba(0,255,224,0.3)] transition-shadow text-sm"
            >
              Explore Agents
              <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
            <Link
              href="/create"
              className="px-8 py-3.5 text-[#00FFE0] font-semibold rounded-lg border border-[#00FFE0]/20 hover:border-[#00FFE0]/40 hover:bg-[#00FFE0]/[0.05] transition-all text-sm"
            >
              Create Agent
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ── Stat Block ── */

function StatBlock({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string;
  prefix: string;
  suffix?: string;
}) {
  return (
    <div className="px-6 py-6 text-center">
      <p className="text-[10px] text-zinc-600 uppercase tracking-[0.15em] font-mono mb-2">
        {label}
      </p>
      <p
        className="text-3xl md:text-4xl font-bold tracking-tight bg-gradient-to-b from-white to-zinc-500 bg-clip-text text-transparent"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </p>
      {suffix && (
        <p className="text-[10px] text-zinc-600 font-mono mt-1">{suffix}</p>
      )}
    </div>
  );
}

/* ── Marquee Items ── */

function MarqueeItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 whitespace-nowrap">
      <span className="text-[10px] text-zinc-600 uppercase tracking-wider font-mono">{label}</span>
      <span className="text-xs text-zinc-400 font-medium">{value}</span>
    </div>
  );
}

function MarqueeDot() {
  return <span className="w-1 h-1 rounded-full bg-[#00FFE0]/30 shrink-0" />;
}

/* ── Icons ── */

function ChartIcon() {
  return (
    <svg className="w-5 h-5 text-[#00FFE0]" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg className="w-5 h-5 text-[#00FFE0]" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg className="w-5 h-5 text-[#00FFE0]" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  );
}

/* ── SDK Section ── */

const sdkTabs = [
  {
    id: "mcp",
    label: "MCP",
    file: "server.py",
    lines: [
      { spans: [{ text: "from ", c: "text-[#00FFE0]" }, { text: "fastmcp ", c: "text-gray-300" }, { text: "import ", c: "text-[#00FFE0]" }, { text: "FastMCP", c: "text-yellow-300" }] },
      { spans: [{ text: "from ", c: "text-[#00FFE0]" }, { text: "gt8004.middleware.mcp ", c: "text-gray-300" }, { text: "import ", c: "text-[#00FFE0]" }, { text: "GT8004MCPMiddleware", c: "text-yellow-300" }] },
      { spans: [] },
      { spans: [{ text: "mcp ", c: "text-gray-300" }, { text: "= ", c: "text-zinc-500" }, { text: "FastMCP", c: "text-yellow-300" }, { text: "(", c: "text-zinc-500" }, { text: "\"my-server\"", c: "text-green-400" }, { text: ")", c: "text-zinc-500" }] },
      { spans: [{ text: "mcp", c: "text-gray-300" }, { text: ".", c: "text-zinc-500" }, { text: "add_middleware", c: "text-yellow-300" }, { text: "(", c: "text-zinc-500" }, { text: "GT8004MCPMiddleware", c: "text-yellow-300" }, { text: ".", c: "text-zinc-500" }, { text: "from_env", c: "text-yellow-300" }, { text: "())", c: "text-zinc-500" }] },
      { spans: [] },
      { spans: [{ text: "@", c: "text-[#00FFE0]" }, { text: "mcp", c: "text-gray-300" }, { text: ".", c: "text-zinc-500" }, { text: "tool", c: "text-yellow-300" }, { text: "()", c: "text-zinc-500" }] },
      { spans: [{ text: "def ", c: "text-[#00FFE0]" }, { text: "search", c: "text-yellow-300" }, { text: "(", c: "text-zinc-500" }, { text: "query", c: "text-gray-300" }, { text: ": ", c: "text-zinc-500" }, { text: "str", c: "text-cyan-300" }, { text: ")", c: "text-zinc-500" }, { text: " -> ", c: "text-zinc-500" }, { text: "str", c: "text-cyan-300" }, { text: ":", c: "text-zinc-500" }] },
      { spans: [{ text: "    ", c: "" }, { text: "return ", c: "text-[#00FFE0]" }, { text: "\"results...\"", c: "text-green-400" }] },
    ],
  },
  {
    id: "a2a",
    label: "A2A",
    file: "server.py",
    lines: [
      { spans: [{ text: "from ", c: "text-[#00FFE0]" }, { text: "fastapi ", c: "text-gray-300" }, { text: "import ", c: "text-[#00FFE0]" }, { text: "FastAPI", c: "text-yellow-300" }] },
      { spans: [{ text: "from ", c: "text-[#00FFE0]" }, { text: "gt8004.middleware.fastapi ", c: "text-gray-300" }, { text: "import ", c: "text-[#00FFE0]" }, { text: "GT8004Middleware", c: "text-yellow-300" }] },
      { spans: [] },
      { spans: [{ text: "app ", c: "text-gray-300" }, { text: "= ", c: "text-zinc-500" }, { text: "FastAPI", c: "text-yellow-300" }, { text: "()", c: "text-zinc-500" }] },
      { spans: [{ text: "app", c: "text-gray-300" }, { text: ".", c: "text-zinc-500" }, { text: "add_middleware", c: "text-yellow-300" }, { text: "(", c: "text-zinc-500" }, { text: "GT8004Middleware", c: "text-yellow-300" }, { text: ".", c: "text-zinc-500" }, { text: "from_env", c: "text-yellow-300" }, { text: "())", c: "text-zinc-500" }] },
    ],
  },
  {
    id: "flask",
    label: "Flask",
    file: "app.py",
    lines: [
      { spans: [{ text: "from ", c: "text-[#00FFE0]" }, { text: "flask ", c: "text-gray-300" }, { text: "import ", c: "text-[#00FFE0]" }, { text: "Flask", c: "text-yellow-300" }] },
      { spans: [{ text: "from ", c: "text-[#00FFE0]" }, { text: "gt8004.middleware.flask ", c: "text-gray-300" }, { text: "import ", c: "text-[#00FFE0]" }, { text: "GT8004FlaskMiddleware", c: "text-yellow-300" }] },
      { spans: [] },
      { spans: [{ text: "app ", c: "text-gray-300" }, { text: "= ", c: "text-zinc-500" }, { text: "Flask", c: "text-yellow-300" }, { text: "(", c: "text-zinc-500" }, { text: "__name__", c: "text-cyan-300" }, { text: ")", c: "text-zinc-500" }] },
      { spans: [{ text: "app", c: "text-gray-300" }, { text: ".", c: "text-zinc-500" }, { text: "wsgi_app ", c: "text-gray-300" }, { text: "= ", c: "text-zinc-500" }, { text: "GT8004FlaskMiddleware", c: "text-yellow-300" }, { text: ".", c: "text-zinc-500" }, { text: "from_env", c: "text-yellow-300" }, { text: "(", c: "text-zinc-500" }, { text: "app", c: "text-gray-300" }, { text: ".", c: "text-zinc-500" }, { text: "wsgi_app", c: "text-gray-300" }, { text: ")", c: "text-zinc-500" }] },
    ],
  },
] as const;

function SDKSection() {
  const [activeTab, setActiveTab] = useState<string>("mcp");
  const tab = sdkTabs.find((t) => t.id === activeTab) ?? sdkTabs[0];

  return (
    <section className="max-w-5xl mx-auto px-6 py-28">
      <div className="grid md:grid-cols-2 gap-12 items-start">
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-px flex-1 max-w-[40px] bg-[#00FFE0]/40" />
            <span className="text-xs text-[#00FFE0] uppercase tracking-[0.2em] font-medium font-mono">Integration</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Start in 3 lines
          </h2>
          <p className="mt-4 text-zinc-400 leading-relaxed">
            Drop in the Python SDK — zero config, zero latency impact.
            Your agent gets analytics, customer tracking, and
            revenue monitoring instantly.
          </p>
          <div className="mt-6 mb-6">
            <code className="text-xs text-zinc-500 font-mono bg-[#111] px-3 py-1.5 rounded-md border border-[#1a1a1a]">
              pip install git+https://github.com/vataops/gt8004-sdk.git
            </code>
          </div>
          <div className="mt-8 space-y-4">
            {[
              { text: "Async logging — no added latency", mono: "~0ms" },
              { text: "MCP \u00b7 A2A \u00b7 Flask \u00b7 FastAPI", mono: "multi" },
              { text: "Free forever — no usage limits", mono: "$0" },
            ].map((item) => (
              <div key={item.text} className="flex items-center gap-4">
                <span className="w-14 text-right font-mono text-xs text-[#00FFE0]/60">{item.mono}</span>
                <div className="w-px h-4 bg-[#1f1f1f]" />
                <span className="text-sm text-zinc-400">{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Terminal code block */}
        <div className="relative">
          <div className="absolute -inset-4 bg-[#00FFE0]/[0.02] rounded-3xl blur-2xl" />
          <div className="relative rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] overflow-hidden">
            {/* Terminal chrome */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a]">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#1a1a1a] hover:bg-red-500/60 transition-colors" />
                  <span className="w-3 h-3 rounded-full bg-[#1a1a1a] hover:bg-yellow-500/60 transition-colors" />
                  <span className="w-3 h-3 rounded-full bg-[#1a1a1a] hover:bg-green-500/60 transition-colors" />
                </div>
                <span className="text-[11px] text-zinc-600 font-mono ml-2">{tab.file}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00FFE0]/40" />
                <span className="text-[10px] text-zinc-600 font-mono">Python</span>
              </div>
            </div>
            {/* Framework tabs */}
            <div className="flex border-b border-[#1a1a1a]">
              {sdkTabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`px-4 py-2 text-xs font-mono transition-colors ${
                    activeTab === t.id
                      ? "text-[#00FFE0] border-b border-[#00FFE0] bg-[#00FFE0]/[0.03]"
                      : "text-zinc-600 hover:text-zinc-400"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {/* Code with line numbers */}
            <div className="flex">
              <div className="py-5 px-3 text-right border-r border-[#1a1a1a] select-none">
                {tab.lines.map((_, i) => (
                  <div key={i} className="text-[11px] leading-relaxed text-zinc-700 font-mono">{i + 1}</div>
                ))}
              </div>
              <pre className="py-5 px-5 text-sm leading-relaxed overflow-x-auto flex-1">
                <code>
                  {tab.lines.map((line, i) => (
                    <span key={i}>
                      {line.spans.map((s, j) => (
                        <span key={j} className={s.c}>{s.text}</span>
                      ))}
                      {i < tab.lines.length - 1 ? "\n" : ""}
                    </span>
                  ))}
                </code>
              </pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
