"use client";

import Link from "next/link";
import { useState } from "react"; // used by SDKSection
import { useNetworkStats, useOverview } from "@/lib/hooks";
import { NETWORK_LIST } from "@/lib/networks";

/* ── Mock Data ── */

const MOCK_AGENTS = [
  { name: "SearchBot", tokenId: 12, chain: "Base", requests: 8420, customers: 234, revenue: 1892.5, health: "healthy" as const, services: ["MCP", "A2A"] },
  { name: "DataAgent", tokenId: 7, chain: "Base", requests: 3102, customers: 89, revenue: 412.0, health: "healthy" as const, services: ["A2A", "HTTP"] },
  { name: "CodeReview", tokenId: 23, chain: "Base", requests: 1325, customers: 45, revenue: 37.0, health: "unhealthy" as const, services: ["MCP"] },
];

const MOCK_TOTAL_REQUESTS = MOCK_AGENTS.reduce((s, a) => s + a.requests, 0);
const MOCK_TOTAL_REVENUE = MOCK_AGENTS.reduce((s, a) => s + a.revenue, 0);

const BAR_COLORS = ["#00FFE0", "#06b6d4", "#8b5cf6", "#f59e0b", "#ef4444"];

/* ── Main Page ── */

export default function LandingPage() {
  const { data: stats } = useNetworkStats();
  const { data: overview } = useOverview();

  const totalAgents = stats?.total ?? 0;
  const totalRequests = overview?.total_requests ?? 0;
  const totalRevenue = overview?.total_revenue_usdc ?? 0;

  return (
    <div className="-mx-6 -mt-6">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden min-h-[90vh] flex flex-col justify-center">
        {/* Background layers */}
        <div className="absolute inset-0 tech-grid" />
        <div className="absolute inset-0 noise-overlay" />

        {/* Animated glow orbs — reduced intensity */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div
            className="absolute -top-[200px] -left-[200px] w-[700px] h-[700px] rounded-full bg-[#00FFE0]/[0.05]"
            style={{ animation: "glow-pulse 8s ease-in-out infinite", filter: "blur(80px)" }}
          />
          <div
            className="absolute top-[30%] -right-[150px] w-[500px] h-[500px] rounded-full bg-[#00FFE0]/[0.04]"
            style={{ animation: "glow-pulse 8s ease-in-out 3s infinite", filter: "blur(60px)" }}
          />
          <div
            className="absolute -bottom-[200px] left-[30%] w-[600px] h-[600px] rounded-full bg-[#00FFE0]/[0.03]"
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

        {/* ── Hero Text ── */}
        <div className="relative z-10 max-w-5xl mx-auto px-6 pt-20 pb-8 w-full">
          {/* Status badge */}
          <div className="animate-fade-in mb-8">
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

          {/* Headline */}
          <div className="animate-fade-in">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.1]">
              <span className="block text-[#ededed]">The operating system</span>
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

          {/* Subtitle */}
          <div className="animate-fade-in-delay mt-6 max-w-2xl">
            <p className="text-lg md:text-xl text-zinc-400 leading-relaxed">
              <span className="font-mono text-[#00FFE0]/80">Requests</span>
              <span className="text-zinc-600 mx-2">&middot;</span>
              <span className="font-mono text-[#00FFE0]/80">Customers</span>
              <span className="text-zinc-600 mx-2">&middot;</span>
              <span className="font-mono text-[#00FFE0]/80">Revenue</span>
              <span className="text-zinc-600 mx-2">&middot;</span>
              <span className="font-mono text-[#00FFE0]/80">Health</span>
              <span className="text-zinc-500 ml-1"> &mdash; All in one dashboard.</span>
            </p>
          </div>

          {/* CTAs */}
          <div className="animate-fade-in-delay-2 mt-10 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <Link
              href="/my-agents"
              className="group inline-flex items-center gap-2 px-8 py-3.5 bg-[#00FFE0] text-black font-semibold rounded-lg hover:shadow-[0_0_30px_rgba(0,255,224,0.35)] transition-shadow text-sm"
            >
              Go to Dashboard
              <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
            <a
              href="#features"
              className="inline-flex items-center gap-2 px-6 py-3.5 text-[#00FFE0] font-semibold rounded-lg border border-[#00FFE0]/20 hover:border-[#00FFE0]/40 hover:bg-[#00FFE0]/[0.05] transition-all text-sm"
            >
              See Features
              <svg className="w-4 h-4" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
              </svg>
            </a>
            <Link
              href="/explorer"
              className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-[#00FFE0] transition-colors font-medium"
            >
              Browse Agents
              <svg className="w-3.5 h-3.5" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
          </div>
        </div>

        {/* ── Dashboard Mock ── */}
        <div className="relative z-10 max-w-5xl mx-auto px-6 pb-12 w-full animate-fade-in-delay-3">
          <div className="relative" style={{ perspective: "1200px" }}>
            <div className="md:transform md:[transform:rotateX(2deg)]">
              <DashboardMock />
            </div>
            {/* Glow beneath */}
            <div className="absolute -bottom-16 left-[10%] right-[10%] h-[120px] bg-[#00FFE0]/[0.06] blur-[80px] rounded-full pointer-events-none" />
          </div>
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[#0a0a0a] to-transparent pointer-events-none" />
      </section>

      {/* ── Feature Deep-Dive: Requests ── */}
      <section id="features" className="max-w-5xl mx-auto px-6 py-24">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px flex-1 max-w-[40px] bg-[#00FFE0]/40" />
              <span className="text-xs text-[#00FFE0] uppercase tracking-[0.2em] font-medium font-mono">Requests</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Track every request, down to the customer
            </h2>
            <p className="mt-4 text-zinc-400 leading-relaxed">
              See real-time request volume per agent, identify your top customers,
              and spot traffic patterns with 30-day trend analysis.
            </p>
            <div className="mt-8 space-y-4">
              {[
                { mono: "30d", text: "Daily trend charts with request volume" },
                { mono: "Top 10", text: "Agent ranking by requests and customers" },
                { mono: "Per-user", text: "Individual customer tracking" },
              ].map((item) => (
                <div key={item.mono} className="flex items-center gap-4">
                  <span className="w-14 text-right font-mono text-xs text-[#00FFE0]/60">{item.mono}</span>
                  <div className="w-px h-4 bg-[#1f1f1f]" />
                  <span className="text-sm text-zinc-400">{item.text}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <RequestsMock />
          </div>
        </div>
      </section>

      {/* ── Feature Deep-Dive: Revenue ── */}
      <section className="max-w-5xl mx-auto px-6 py-24">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="order-2 md:order-1">
            <RevenueMock />
          </div>
          <div className="order-1 md:order-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px flex-1 max-w-[40px] bg-[#00FFE0]/40" />
              <span className="text-xs text-[#00FFE0] uppercase tracking-[0.2em] font-medium font-mono">Revenue</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Know exactly what your agents earn
            </h2>
            <p className="mt-4 text-zinc-400 leading-relaxed">
              Track USDC revenue per agent, calculate average revenue per request,
              and see which agents are monetizing across your entire portfolio.
            </p>
            <div className="mt-8 space-y-4">
              {[
                { mono: "USDC", text: "Real-time revenue tracking per agent" },
                { mono: "ARPU", text: "Average revenue per request" },
                { mono: "%", text: "Monetization rate across portfolio" },
              ].map((item) => (
                <div key={item.mono} className="flex items-center gap-4">
                  <span className="w-14 text-right font-mono text-xs text-[#00FFE0]/60">{item.mono}</span>
                  <div className="w-px h-4 bg-[#1f1f1f]" />
                  <span className="text-sm text-zinc-400">{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Feature Deep-Dive: Health ── */}
      <section className="max-w-5xl mx-auto px-6 py-24">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="h-px flex-1 max-w-[40px] bg-[#00FFE0]/40" />
            <span className="text-xs text-[#00FFE0] uppercase tracking-[0.2em] font-medium font-mono">Observability</span>
            <div className="h-px flex-1 max-w-[40px] bg-[#00FFE0]/40" />
          </div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Every endpoint, always monitored
          </h2>
          <p className="mt-4 text-zinc-400 leading-relaxed max-w-lg mx-auto">
            Automatic health checks for every service your agents expose.
            Track response times and get alerted to errors.
          </p>
        </div>
        <div className="max-w-4xl mx-auto">
          <HealthMock />
        </div>
      </section>

      {/* ── Protocol Stats Marquee ── */}
      <section className="relative border-y border-[#1a1a1a] overflow-hidden py-4">
        <div className="flex" style={{ animation: "marquee 30s linear infinite", width: "max-content" }}>
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex items-center gap-12 px-6">
              <MarqueeItem label="Protocol" value="ERC-8004" />
              <MarqueeDot />
              <MarqueeItem label="Networks" value={NETWORK_LIST.map((n) => n.shortName).join(" \u00b7 ")} />
              <MarqueeDot />
              <MarqueeItem label="Payments" value="USDC via x402" />
              <MarqueeDot />
            </div>
          ))}
        </div>
      </section>

      {/* ── SDK ── */}
      <SDKSection />

      {/* ── Live Stats Ticker ── */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <div className="animated-border bg-[#0a0a0a]/90 backdrop-blur-md rounded-2xl">
          <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#1a1a1a]">
            <StatBlock label="On-chain Agents" value={totalAgents.toLocaleString()} />
            <StatBlock label="Total Requests" value={totalRequests.toLocaleString()} />
            <StatBlock label="Total Revenue" value={`$${totalRevenue.toFixed(2)}`} suffix="USDC" />
            <StatBlock label="Networks" value={String(NETWORK_LIST.length)} />
          </div>
        </div>
      </section>

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
            Your agents are already on-chain.
            <br />
            <span className="text-zinc-500">Now see what they&apos;re doing.</span>
          </h2>
          <p className="mt-5 text-zinc-400 text-lg max-w-md mx-auto">
            Connect your wallet to access your free dashboard.
            No setup, no credit card.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              href="/my-agents"
              className="group inline-flex items-center gap-2 px-8 py-3.5 bg-[#00FFE0] text-black font-semibold rounded-lg hover:shadow-[0_0_40px_rgba(0,255,224,0.3)] transition-shadow text-sm"
            >
              Go to Dashboard
              <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
            <Link
              href="/explorer"
              className="px-8 py-3.5 text-[#00FFE0] font-semibold rounded-lg border border-[#00FFE0]/20 hover:border-[#00FFE0]/40 hover:bg-[#00FFE0]/[0.05] transition-all text-sm"
            >
              Browse Agents
            </Link>
          </div>
          <p className="mt-6 text-[11px] text-zinc-600 font-mono tracking-wide">
            Free forever &middot; No usage limits &middot; No latency overhead
          </p>
        </div>
      </section>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   Mock Components — static, hardcoded, no API calls
   ══════════════════════════════════════════════════ */

/* ── Browser Frame ── */

function BrowserFrame({ url, children }: { url: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1a1a1a]">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#1a1a1a]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#1a1a1a]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#1a1a1a]" />
          </div>
        </div>
        <div className="flex-1 mx-4">
          <div className="bg-[#141414] rounded-md px-3 py-1 text-[10px] text-zinc-600 font-mono text-center max-w-xs mx-auto">
            {url}
          </div>
        </div>
        <div className="w-12" />
      </div>
      {children}
    </div>
  );
}

/* ── Mock Stat Card ── */

function MockStatCard({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-lg p-3">
      <p className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono mb-1">{label}</p>
      <p className="text-lg font-bold text-[#ededed]" style={{ fontVariantNumeric: "tabular-nums" }}>
        {value}
        {suffix && <span className="text-[9px] text-zinc-600 font-mono ml-1">{suffix}</span>}
      </p>
    </div>
  );
}

/* ── Mock Horizontal Bar ── */

function MockBar({ label, value, percent, color }: { label: string; value: string; percent: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-zinc-400 truncate">{label}</span>
        <span className="text-zinc-500 font-mono ml-2 shrink-0">{value}</span>
      </div>
      <div className="h-2 bg-[#141414] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${percent}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

/* ── Dashboard Mock (Hero) ── */

function DashboardMock() {
  return (
    <BrowserFrame url="gt8004.xyz/my-agents">
      <div className="p-4 space-y-4">
        {/* Tab bar */}
        <div className="flex gap-1 border-b border-[#1a1a1a]">
          {["Overview", "Requests", "Revenue", "Observability"].map((tab) => (
            <span
              key={tab}
              className={`px-3 py-1.5 text-[10px] font-mono ${
                tab === "Overview"
                  ? "text-[#00FFE0] border-b border-[#00FFE0]"
                  : "text-zinc-600"
              }`}
            >
              {tab}
            </span>
          ))}
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <MockStatCard label="Total Agents" value="5" />
          <MockStatCard label="Healthy" value="4 / 5" />
          <MockStatCard label="Total Requests" value="12,847" />
          <MockStatCard label="Total Revenue" value="$2,341.50" suffix="USDC" />
        </div>

        {/* Breakdown charts */}
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-lg p-3">
            <p className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono mb-3">Requests by Agent</p>
            <div className="space-y-2">
              {MOCK_AGENTS.map((a, i) => (
                <MockBar
                  key={a.name}
                  label={a.name}
                  value={a.requests.toLocaleString()}
                  percent={(a.requests / MOCK_TOTAL_REQUESTS) * 100}
                  color={BAR_COLORS[i]}
                />
              ))}
            </div>
          </div>
          <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-lg p-3">
            <p className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono mb-3">Revenue by Agent</p>
            <div className="space-y-2">
              {MOCK_AGENTS.map((a, i) => (
                <MockBar
                  key={a.name}
                  label={a.name}
                  value={`$${a.revenue.toFixed(0)}`}
                  percent={(a.revenue / MOCK_TOTAL_REVENUE) * 100}
                  color={BAR_COLORS[i]}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Agent table */}
        <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-lg overflow-hidden">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b border-[#1a1a1a] text-zinc-600 font-mono uppercase tracking-wider">
                <th className="text-left px-3 py-2 font-medium">Agent</th>
                <th className="text-left px-3 py-2 font-medium hidden sm:table-cell">Chain</th>
                <th className="text-right px-3 py-2 font-medium">Requests</th>
                <th className="text-right px-3 py-2 font-medium hidden sm:table-cell">Customers</th>
                <th className="text-center px-3 py-2 font-medium">Health</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a1a1a]/50">
              {MOCK_AGENTS.map((a) => (
                <tr key={a.name} className="text-zinc-400">
                  <td className="px-3 py-2">
                    <span className="text-[#ededed] font-medium">{a.name}</span>
                    <span className="text-zinc-600 ml-1">#{a.tokenId}</span>
                  </td>
                  <td className="px-3 py-2 hidden sm:table-cell">
                    <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded text-[9px] font-mono">{a.chain}</span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{a.requests.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right font-mono hidden sm:table-cell">{a.customers}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`inline-block w-2 h-2 rounded-full ${a.health === "healthy" ? "bg-green-500" : "bg-red-500"}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </BrowserFrame>
  );
}

/* ── Requests Mock ── */

function RequestsMock() {
  // Fake 30-day sparkline data
  const points = [320, 280, 410, 390, 350, 480, 520, 460, 440, 510, 490, 530, 620, 580, 540, 600, 650, 630, 680, 720, 690, 710, 750, 800, 770, 820, 860, 840, 890, 920];
  const max = Math.max(...points);
  const min = Math.min(...points);
  const w = 300;
  const h = 80;
  const path = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((p - min) / (max - min)) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const areaPath = `${path} L${w},${h} L0,${h} Z`;

  return (
    <BrowserFrame url="gt8004.xyz/my-agents#requests">
      <div className="p-4 space-y-3">
        {/* Line chart */}
        <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-lg p-3">
          <p className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono mb-2">Requests Over Time &mdash; Last 30 Days</p>
          <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-20" preserveAspectRatio="none">
            <defs>
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00FFE0" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#00FFE0" stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* Grid lines */}
            {[0.25, 0.5, 0.75].map((frac) => (
              <line key={frac} x1="0" y1={h * frac} x2={w} y2={h * frac} stroke="#1a1a1a" strokeWidth="0.5" />
            ))}
            <path d={areaPath} fill="url(#areaGrad)" />
            <path d={path} fill="none" stroke="#00FFE0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {/* Top agents bar chart */}
        <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-lg p-3">
          <p className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono mb-3">Top Agents by Requests</p>
          <div className="space-y-2">
            {MOCK_AGENTS.map((a, i) => (
              <MockBar
                key={a.name}
                label={`${a.name} #${a.tokenId}`}
                value={`${a.requests.toLocaleString()} (${((a.requests / MOCK_TOTAL_REQUESTS) * 100).toFixed(0)}%)`}
                percent={(a.requests / MOCK_TOTAL_REQUESTS) * 100}
                color={BAR_COLORS[i]}
              />
            ))}
          </div>
        </div>
      </div>
    </BrowserFrame>
  );
}

/* ── Revenue Mock ── */

function RevenueMock() {
  return (
    <BrowserFrame url="gt8004.xyz/my-agents#revenue">
      <div className="p-4 space-y-3">
        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-2">
          <MockStatCard label="Total Revenue" value="$2,341.50" suffix="USDC" />
          <MockStatCard label="Portfolio ARPU" value="$0.18" suffix="/req" />
          <MockStatCard label="Paying Agents" value="3 / 5" suffix="60%" />
        </div>

        {/* Top agents by revenue */}
        <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-lg p-3">
          <p className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono mb-3">Top Agents by Revenue</p>
          <div className="space-y-2">
            {MOCK_AGENTS.map((a, i) => (
              <MockBar
                key={a.name}
                label={`${a.name} #${a.tokenId}`}
                value={`$${a.revenue.toFixed(2)} (${((a.revenue / MOCK_TOTAL_REVENUE) * 100).toFixed(0)}%)`}
                percent={(a.revenue / MOCK_TOTAL_REVENUE) * 100}
                color={BAR_COLORS[i]}
              />
            ))}
          </div>
        </div>
      </div>
    </BrowserFrame>
  );
}

/* ── Health Mock ── */

function HealthMock() {
  const agents = [
    { name: "SearchBot", id: 12, health: "healthy", services: [{ name: "MCP", status: "healthy" }, { name: "A2A", status: "healthy" }], avgMs: 124 },
    { name: "DataAgent", id: 7, health: "healthy", services: [{ name: "A2A", status: "healthy" }, { name: "HTTP", status: "healthy" }], avgMs: 89 },
    { name: "CodeReview", id: 23, health: "unhealthy", services: [{ name: "MCP", status: "unhealthy" }], avgMs: 2340 },
  ];

  return (
    <BrowserFrame url="gt8004.xyz/my-agents#observability">
      <div className="p-4 space-y-3">
        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-2">
          <MockStatCard label="Health Status" value="4 / 5" suffix="healthy" />
          <MockStatCard label="Avg Response" value="142" suffix="ms" />
          <MockStatCard label="Error Rate" value="0.12" suffix="%" />
        </div>

        {/* Health grid */}
        <div className="grid sm:grid-cols-3 gap-2">
          {agents.map((a) => (
            <div
              key={a.id}
              className={`bg-[#0f0f0f] rounded-lg p-3 border ${
                a.health === "healthy" ? "border-green-500/20" : "border-red-500/30"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-[#ededed] font-medium">{a.name} <span className="text-zinc-600">#{a.id}</span></span>
                <span className="text-[9px] text-zinc-600 font-mono">{a.avgMs}ms</span>
              </div>
              <div className="flex gap-2">
                {a.services.map((s) => (
                  <div key={s.name} className="flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${s.status === "healthy" ? "bg-green-500" : "bg-red-500"}`} />
                    <span className="text-[9px] text-zinc-500 font-mono">{s.name}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Alert box */}
        <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-3.5 h-3.5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <span className="text-[10px] text-yellow-500 font-semibold uppercase tracking-wider">Agents Requiring Attention</span>
          </div>
          <p className="text-[10px] text-zinc-400">
            <span className="text-red-400 font-medium">CodeReview #23</span> &mdash; MCP endpoint unhealthy (timeout after 2340ms)
          </p>
        </div>
      </div>
    </BrowserFrame>
  );
}

/* ══════════════════════════════════════════
   Existing Helper Components
   ══════════════════════════════════════════ */

/* ── Stat Block ── */

function StatBlock({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string;
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
            Ship analytics in 3 lines
          </h2>
          <p className="mt-4 text-zinc-400 leading-relaxed">
            Install the Python SDK and add one middleware call. Every request your
            agent handles automatically flows to your GT8004 dashboard &mdash;
            requests, customers, revenue, all captured with zero latency overhead.
          </p>
          <div className="mt-6 mb-6">
            <code className="text-xs text-zinc-500 font-mono bg-[#111] px-3 py-1.5 rounded-md border border-[#1a1a1a]">
              pip install git+https://github.com/vataops/gt8004-sdk.git
            </code>
          </div>
          <div className="mt-8 space-y-4">
            {[
              { text: "Async logging \u2014 no added latency", mono: "~0ms" },
              { text: "MCP \u00b7 A2A \u00b7 Flask \u00b7 FastAPI", mono: "multi" },
              { text: "Free forever \u2014 no usage limits", mono: "$0" },
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
