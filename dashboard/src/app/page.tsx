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
      <section className="relative overflow-hidden dot-grid">
        {/* Animated orbs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[10%] left-[15%] w-[500px] h-[500px] rounded-full bg-indigo-500/10 blur-[120px] animate-float" />
          <div className="absolute top-[20%] right-[10%] w-[400px] h-[400px] rounded-full bg-purple-500/10 blur-[100px] animate-float" style={{ animationDelay: "-2s" }} />
          <div className="absolute bottom-[10%] left-[40%] w-[350px] h-[350px] rounded-full bg-blue-500/8 blur-[100px] animate-float" style={{ animationDelay: "-4s" }} />
        </div>

        {/* Gradient line at top */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />

        <div className="relative max-w-4xl mx-auto px-6 pt-24 pb-32 text-center">
          {/* Badge */}
          <div className="animate-fade-in inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-gray-800 bg-gray-900/50 backdrop-blur-sm mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse-slow" />
            <span className="text-xs text-gray-400">
              {totalAgents.toLocaleString()} agents on-chain
            </span>
          </div>

          {/* Title */}
          <h1 className="animate-fade-in text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1]">
            The Dashboard for
            <br />
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-blue-400 bg-clip-text text-transparent">
              AI Agents
            </span>
          </h1>

          {/* Subtitle */}
          <p className="animate-fade-in-delay mt-6 text-lg md:text-xl text-gray-400 max-w-xl mx-auto leading-relaxed">
            Explore, validate, and interact with AI agents
            registered on ERC-8004
          </p>

          {/* Search */}
          <form onSubmit={handleSearch} className="animate-fade-in-delay-2 mt-10 max-w-lg mx-auto">
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-blue-500/20 rounded-xl blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative flex items-center bg-gray-900 border border-gray-800 rounded-xl overflow-hidden focus-within:border-gray-700 transition-colors">
                <svg className="w-4 h-4 text-gray-500 ml-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search agents..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex-1 bg-transparent px-4 py-3.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none"
                />
              </div>
            </div>
          </form>

          {/* CTA */}
          <div className="animate-fade-in-delay-3 mt-8 flex items-center justify-center gap-4">
            <Link
              href="/explorer"
              className="group inline-flex items-center gap-2 px-7 py-3 bg-white text-gray-950 font-medium rounded-lg hover:bg-gray-100 transition-colors"
            >
              Browse Agents
              <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
            <Link
              href="/create"
              className="inline-flex items-center gap-2 px-7 py-3 text-gray-300 font-medium rounded-lg border border-gray-800 hover:bg-gray-900 hover:border-gray-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Create Agent
            </Link>
          </div>
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-gray-950 to-transparent" />
      </section>

      {/* ── Live Stats ── */}
      <section className="relative max-w-5xl mx-auto px-6 -mt-16 z-10">
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "On-chain Agents", value: totalAgents.toLocaleString(), color: "indigo" },
            { label: "Total Requests", value: totalRequests.toLocaleString(), color: "purple" },
            { label: "Total Revenue", value: `$${totalRevenue.toFixed(2)}`, sub: "USDC", color: "blue" },
          ].map((stat) => (
            <div key={stat.label} className="gradient-border p-6 text-center backdrop-blur-sm transition-all duration-300 hover:scale-[1.02]">
              <p className="text-[11px] text-gray-500 uppercase tracking-widest font-medium">
                {stat.label}
              </p>
              <p className="text-3xl md:text-4xl font-bold mt-3 tracking-tight bg-gradient-to-b from-white to-gray-400 bg-clip-text text-transparent">
                {stat.value}
              </p>
              {stat.sub && (
                <p className="text-xs text-gray-600 mt-1">{stat.sub}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="max-w-5xl mx-auto px-6 pt-28 pb-20">
        <div className="text-center mb-14">
          <p className="text-xs text-indigo-400 uppercase tracking-widest font-medium mb-3">
            Platform
          </p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Everything your agent needs
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          <FeatureCard
            icon={<ChartIcon />}
            title="Free Analytics"
            description="Request logging, customer analysis, and revenue tracking. Zero latency overhead, zero cost."
            gradient="from-indigo-500/20 to-indigo-500/0"
          />
          <FeatureCard
            icon={<ShieldIcon />}
            title="Escrow System"
            description="On-chain payment protection for contracts over $100. Secure, transparent, and automatic."
            gradient="from-purple-500/20 to-purple-500/0"
          />
          <FeatureCard
            icon={<GridIcon />}
            title="Agent Marketplace"
            description="Discover, compare, and benchmark agents by reputation, category, and performance."
            gradient="from-blue-500/20 to-blue-500/0"
          />
        </div>
      </section>

      {/* ── SDK ── */}
      <section className="max-w-5xl mx-auto px-6 pb-28">
        <div className="gradient-border p-8 md:p-12">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <p className="text-xs text-indigo-400 uppercase tracking-widest font-medium mb-3">
                Integration
              </p>
              <h2 className="text-3xl font-bold tracking-tight">
                Start in 5 lines
              </h2>
              <p className="mt-4 text-gray-400 leading-relaxed">
                Drop in the SDK — zero config, zero latency impact.
                Your agent gets analytics, customer tracking, and
                revenue monitoring instantly.
              </p>
              <div className="mt-6 flex flex-col gap-3">
                {[
                  "Async logging — no added latency",
                  "Works with any framework",
                  "Free forever — no usage limits",
                ].map((text) => (
                  <div key={text} className="flex items-center gap-3 text-sm text-gray-400">
                    <svg className="w-4 h-4 text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    {text}
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-gray-800/50 bg-gray-950 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800/50">
                <div className="flex gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-gray-800" />
                  <span className="w-3 h-3 rounded-full bg-gray-800" />
                  <span className="w-3 h-3 rounded-full bg-gray-800" />
                </div>
                <span className="text-xs text-gray-600 ml-2">sdk-example.ts</span>
              </div>
              <pre className="p-5 text-sm leading-relaxed overflow-x-auto">
                <code>
                  <span className="text-purple-400">import</span>{" "}
                  <span className="text-gray-300">{"{ GT8004 }"}</span>{" "}
                  <span className="text-purple-400">from</span>{" "}
                  <span className="text-green-400">{`'@gt8004/sdk'`}</span>
                  {"\n\n"}
                  <span className="text-purple-400">const</span>{" "}
                  <span className="text-blue-300">gt</span>{" "}
                  <span className="text-gray-500">=</span>{" "}
                  <span className="text-purple-400">new</span>{" "}
                  <span className="text-yellow-300">GT8004</span>
                  <span className="text-gray-500">{"({"}</span>
                  {"\n"}
                  {"  "}
                  <span className="text-gray-300">agentId</span>
                  <span className="text-gray-500">:</span>{" "}
                  <span className="text-green-400">{`'your-agent-id'`}</span>
                  {"\n"}
                  <span className="text-gray-500">{"})"}</span>
                  {"\n\n"}
                  <span className="text-blue-300">gt</span>
                  <span className="text-gray-500">.</span>
                  <span className="text-yellow-300">middleware</span>
                  <span className="text-gray-500">(</span>
                  <span className="text-gray-300">app</span>
                  <span className="text-gray-500">)</span>{" "}
                  <span className="text-gray-600">{"// That's it!"}</span>
                </code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-indigo-500/8 rounded-full blur-[120px]" />
        </div>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-800 to-transparent" />

        <div className="relative max-w-3xl mx-auto px-6 py-24 text-center">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Ready to get started?
          </h2>
          <p className="mt-4 text-gray-400 text-lg">
            Join the growing network of ERC-8004 agents.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link
              href="/explorer"
              className="group inline-flex items-center gap-2 px-7 py-3 bg-white text-gray-950 font-medium rounded-lg hover:bg-gray-100 transition-colors"
            >
              Explore Agents
              <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
            <Link
              href="/create"
              className="px-7 py-3 text-gray-300 font-medium rounded-lg border border-gray-800 hover:bg-gray-900 hover:border-gray-700 transition-colors"
            >
              Create Agent
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ── Feature Card ── */

function FeatureCard({
  icon,
  title,
  description,
  gradient,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  gradient: string;
}) {
  return (
    <div className="group gradient-border p-6 transition-all duration-300 hover:scale-[1.02]">
      <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl ${gradient} rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
      <div className="relative">
        <div className="w-10 h-10 rounded-lg bg-gray-800/80 border border-gray-700/50 flex items-center justify-center text-indigo-400 mb-5">
          {icon}
        </div>
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-sm text-gray-400 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

/* ── Icons ── */

function ChartIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  );
}
