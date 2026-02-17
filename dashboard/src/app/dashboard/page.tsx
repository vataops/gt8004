"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { StatCard } from "@/components/StatCard";
import { openApi, Agent } from "@/lib/api";
import { NETWORK_LIST } from "@/lib/networks";
import { AgentAvatar } from "@/components/RobotIcon";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { RequestsTab } from "./components/RequestsTab";
import { RevenueTab } from "./components/RevenueTab";
import { ObservabilityTab } from "./components/ObservabilityTab";
import { useWalletStats, useWalletDailyStats, useWalletErrors } from "@/lib/hooks";

const AGENT_COLORS = ["#00FFE0", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#ec4899"];

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "requests", label: "Requests" },
  { key: "revenue", label: "Revenue" },
  { key: "observability", label: "Observability" },
] as const;

type TabKey = typeof TABS[number]["key"];

/** Extract agent name from on-chain agentURI (data: URI or raw JSON). */
function parseAgentURIName(uri: string): string {
  if (!uri) return "";
  let json: string | null = null;
  if (uri.startsWith("data:application/json;base64,")) {
    try { json = atob(uri.slice("data:application/json;base64,".length)); } catch { return ""; }
  } else if (uri.startsWith("data:application/json,")) {
    json = uri.slice("data:application/json,".length);
  } else if (uri.startsWith("{")) {
    json = uri;
  }
  if (!json) return "";
  try { return (JSON.parse(json) as { name?: string }).name || ""; } catch { return ""; }
}

interface ParsedService {
  name: string;
  endpoint: string;
}

/** Extract service entries (name + endpoint) from on-chain agentURI metadata. */
function parseAgentURIServiceEntries(uri: string): ParsedService[] {
  if (!uri) return [];
  let json: string | null = null;
  if (uri.startsWith("data:application/json;base64,")) {
    try { json = atob(uri.slice("data:application/json;base64,".length)); } catch { return []; }
  } else if (uri.startsWith("data:application/json,")) {
    json = uri.slice("data:application/json,".length);
  } else if (uri.startsWith("{")) {
    json = uri;
  }
  if (!json) return [];
  try {
    const meta = JSON.parse(json) as { services?: { name: string; endpoint: string }[]; endpoints?: { name: string; endpoint: string }[] };
    const svcs = meta.services ?? meta.endpoints ?? [];
    return svcs.filter((s) => s.name).map((s) => ({ name: s.name.toUpperCase(), endpoint: s.endpoint || "" }));
  } catch { return []; }
}

/** Extract service names from on-chain agentURI metadata. */
function parseAgentURIServices(uri: string): string[] {
  return parseAgentURIServiceEntries(uri).map((s) => s.name);
}

/** Extract image URL from on-chain agentURI metadata. */
function parseAgentURIImage(uri: string): string {
  if (!uri) return "";
  let json: string | null = null;
  if (uri.startsWith("data:application/json;base64,")) {
    try { json = atob(uri.slice("data:application/json;base64,".length)); } catch { return ""; }
  } else if (uri.startsWith("data:application/json,")) {
    json = uri.slice("data:application/json,".length);
  } else if (uri.startsWith("{")) {
    json = uri;
  }
  if (!json) return "";
  try { return (JSON.parse(json) as { image?: string }).image || ""; } catch { return ""; }
}

interface AgentRow {
  agent_id: string;
  name: string;
  token_id: number | null;
  chain: string;
  chain_id: number;
  total_requests: number;
  total_customers: number;
  total_revenue: number;
  avg_response_ms: number;
  status: string;
  created_at: string;
  agent_uri: string;
  registered: boolean;
  services: string[];
  parsed_services: ParsedService[];
  image_url: string;
  origin_endpoint: string;
}

export default function MyAgentsPage() {
  return (
    <Suspense fallback={<p className="text-zinc-500">Loading agents&hellip;</p>}>
      <MyAgentsContent />
    </Suspense>
  );
}

function MyAgentsContent() {
  const { apiKey, walletAddress, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [healthStatus, setHealthStatus] = useState<Record<string, "checking" | "healthy" | "unhealthy">>({});
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    const tab = searchParams.get("tab") as TabKey | null;
    return tab && TABS.some((t) => t.key === tab) ? tab : "overview";
  });

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    const sp = new URLSearchParams(searchParams.toString());
    if (tab === "overview") sp.delete("tab");
    else sp.set("tab", tab);
    router.replace(`?${sp.toString()}`, { scroll: false });
  };
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;

  // Resolve auth for analytics calls
  const auth: string | { walletAddress: string } | null = apiKey
    ? apiKey
    : walletAddress
      ? { walletAddress }
      : null;

  // Wallet analytics hooks
  const { data: walletStats } = useWalletStats(walletAddress, auth);
  const { data: walletDaily } = useWalletDailyStats(walletAddress, auth, 30);
  const { data: walletErrors } = useWalletErrors(walletAddress, auth);

  useEffect(() => {
    if (!authLoading && !walletAddress) {
      router.replace("/login");
    }
  }, [authLoading, walletAddress, router]);

  const loadAgents = useCallback(async () => {
    if (!walletAddress) {
      setLoading(false);
      return;
    }

    try {
      // Fetch platform agents and on-chain tokens in parallel
      const [platformResult, ...tokenResults] = await Promise.allSettled([
        openApi.getWalletAgents(walletAddress),
        ...NETWORK_LIST.map((n) =>
          openApi.listTokensByOwner(walletAddress, n.chainId).then((r) => ({
            network: n,
            tokens: r.tokens || [],
          }))
        ),
      ]);

      const allPlatformAgents: Agent[] =
        platformResult.status === "fulfilled"
          ? platformResult.value.agents || []
          : [];

      // Filter platform agents to current network's chain IDs only
      const validChainIds = new Set(NETWORK_LIST.map((n) => n.chainId));
      const platformAgents = allPlatformAgents.filter(
        (a) => a.chain_id && validChainIds.has(a.chain_id)
      );

      // Collect all on-chain tokens
      const allTokens: { token_id: number; chain_id: number; network: typeof NETWORK_LIST[number]; agent_uri: string }[] = [];
      const seenTokenIds = new Set<string>();

      for (const result of tokenResults) {
        if (result.status !== "fulfilled") continue;
        const { network, tokens } = result.value;
        for (const token of tokens) {
          const key = `${network.chainId}-${token.token_id}`;
          if (seenTokenIds.has(key)) continue;
          seenTokenIds.add(key);
          allTokens.push({ token_id: token.token_id, chain_id: network.chainId, network, agent_uri: token.agent_uri || "" });
        }
      }

      // Build agent rows from on-chain tokens + platform data
      const rows: AgentRow[] = [];

      for (const token of allTokens) {
        // Match with platform agent by token_id + chain_id
        const platformAgent = platformAgents.find(
          (a) => a.erc8004_token_id === token.token_id && a.chain_id === token.chain_id
        );

        // Extract name from on-chain agentURI, fallback to platform agent name
        const uriName = parseAgentURIName(token.agent_uri);
        const name = uriName || platformAgent?.name || `Agent #${token.token_id}`;
        const imageUrl = parseAgentURIImage(token.agent_uri);

        rows.push({
          agent_id: platformAgent?.agent_id || `token-${token.token_id}`,
          name,
          token_id: token.token_id,
          chain: token.network.shortName,
          chain_id: token.chain_id,
          total_requests: platformAgent?.total_requests ?? 0,
          total_customers: platformAgent?.total_customers ?? 0,
          total_revenue: platformAgent?.total_revenue_usdc ?? 0,
          avg_response_ms: platformAgent?.avg_response_ms ?? 0,
          status: platformAgent?.status || "active",
          created_at: platformAgent?.created_at || "",
          agent_uri: token.agent_uri,
          registered: !!platformAgent,
          services: parseAgentURIServices(token.agent_uri),
          parsed_services: parseAgentURIServiceEntries(token.agent_uri),
          image_url: imageUrl,
          origin_endpoint: platformAgent?.origin_endpoint || "",
        });
      }

      // Add platform agents that don't have on-chain tokens
      for (const agent of platformAgents) {
        const hasToken = rows.some(
          (r) => r.agent_id === agent.agent_id
        );
        if (!hasToken) {
          rows.push({
            agent_id: agent.agent_id,
            name: agent.name || agent.agent_id,
            token_id: agent.erc8004_token_id ?? null,
            chain: "-",
            chain_id: 0,
            total_requests: agent.total_requests ?? 0,
            total_customers: agent.total_customers ?? 0,
            total_revenue: agent.total_revenue_usdc ?? 0,
            avg_response_ms: agent.avg_response_ms ?? 0,
            status: agent.status,
            created_at: agent.created_at,
            agent_uri: agent.agent_uri || "",
            registered: true,
            services: parseAgentURIServices(agent.agent_uri || ""),
            parsed_services: parseAgentURIServiceEntries(agent.agent_uri || ""),
            image_url: parseAgentURIImage(agent.agent_uri || ""),
            origin_endpoint: agent.origin_endpoint || "",
          });
        }
      }

      rows.sort((a, b) => (a.registered === b.registered ? 0 : a.registered ? -1 : 1));
      setAgents(rows);
    } catch (err) {
      console.error("Failed to load agents:", err);
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  // Health check for each service endpoint (keyed by "agentId:endpoint")
  useEffect(() => {
    if (agents.length === 0) return;

    // Collect all (agent, service) pairs that have an endpoint
    const checks: { agentId: string; endpoint: string }[] = [];
    for (const agent of agents) {
      if (!agent.registered) continue;
      for (const svc of agent.parsed_services) {
        if (svc.endpoint && svc.name !== "OASF" && (svc.endpoint.startsWith("http://") || svc.endpoint.startsWith("https://"))) checks.push({ agentId: agent.agent_id, endpoint: svc.endpoint });
      }
    }
    if (checks.length === 0) return;

    const init: Record<string, "checking"> = {};
    for (const c of checks) init[`${c.agentId}:${c.endpoint}`] = "checking";
    setHealthStatus(init);
    setLastChecked(new Date());

    const BACKEND_URL = process.env.NEXT_PUBLIC_OPEN_API_URL || "http://localhost:8080";
    for (const c of checks) {
      const key = `${c.agentId}:${c.endpoint}`;
      const healthUrl = `${BACKEND_URL}/v1/proxy/health?endpoint=${encodeURIComponent(c.endpoint)}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 35000);

      fetch(healthUrl, { method: "GET", signal: controller.signal })
        .then(async (res) => {
          clearTimeout(timeout);
          const data = await res.json().catch(() => ({}));
          setHealthStatus((prev) => ({ ...prev, [key]: data.status === "healthy" ? "healthy" : "unhealthy" }));
        })
        .catch(() => {
          clearTimeout(timeout);
          setHealthStatus((prev) => ({ ...prev, [key]: "unhealthy" }));
        });
    }
  }, [agents]);

  const totalAgents = agents.length;
  const totalRequests = agents.reduce((sum, a) => sum + a.total_requests, 0);
  const totalRevenue = agents.reduce((sum, a) => sum + a.total_revenue, 0);
  const totalEndpoints = Object.keys(healthStatus).length;
  const healthyEndpoints = Object.values(healthStatus).filter(s => s === "healthy").length;
  // Chart data: each agent as a segment in the stacked bar
  const chartAgents = agents.map((a, i) => ({
    key: `a${i}`,
    label:
      a.token_id !== null && !a.name.startsWith("Agent #")
        ? `${a.name} #${a.token_id}`
        : a.name,
    requests: a.total_requests,
    revenue: a.total_revenue,
    color: AGENT_COLORS[i % AGENT_COLORS.length],
  }));
  const requestBarData = [
    { _: "req", ...Object.fromEntries(chartAgents.map((a) => [a.key, a.requests])) },
  ];
  const revenueBarData = [
    { _: "rev", ...Object.fromEntries(chartAgents.map((a) => [a.key, a.revenue])) },
  ];

  // Auth resolved but no wallet → redirect (useEffect handles it)
  if (!walletAddress && !authLoading) {
    return null;
  }

  // Skeleton while: data loading, or auth still determining wallet state
  if (loading || (!walletAddress && authLoading)) {
    return (
      <div>
        {/* Header skeleton */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="h-7 w-40 bg-[#1a1a1a] rounded animate-pulse" />
            <div className="h-4 w-72 bg-[#1a1a1a] rounded animate-pulse mt-2" />
          </div>
          <div className="h-9 w-28 bg-[#1a1a1a] rounded animate-pulse" />
        </div>
        {/* Tab skeleton */}
        <div className="border-b border-[#1a1a1a] mb-6">
          <div className="flex gap-0 -mb-px">
            {TABS.map((tab) => (
              <div key={tab.key} className="px-4 py-2.5">
                <div className="h-4 w-16 bg-[#1a1a1a] rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
        {/* Stat cards skeleton */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-lg p-4">
              <div className="h-3 w-20 bg-[#1a1a1a] rounded animate-pulse mb-3" />
              <div className="h-6 w-12 bg-[#1a1a1a] rounded animate-pulse" />
            </div>
          ))}
        </div>
        {/* Table skeleton */}
        <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-lg overflow-hidden">
          <div className="border-b border-[#1a1a1a] p-3 flex gap-4">
            {["Agent", "Chain", "Requests", "Customers", "Status", "Health"].map((h) => (
              <div key={h} className="h-3 w-16 bg-[#1a1a1a] rounded animate-pulse" />
            ))}
          </div>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="border-b border-[#1a1a1a]/50 p-3 flex items-center gap-4">
              <div className="w-8 h-8 bg-[#1a1a1a] rounded-full animate-pulse" />
              <div className="h-4 w-28 bg-[#1a1a1a] rounded animate-pulse" />
              <div className="h-4 w-16 bg-[#1a1a1a] rounded animate-pulse" />
              <div className="h-4 w-12 bg-[#1a1a1a] rounded animate-pulse" />
              <div className="h-4 w-12 bg-[#1a1a1a] rounded animate-pulse" />
              <div className="h-4 w-16 bg-[#1a1a1a] rounded animate-pulse" />
              <div className="h-4 w-14 bg-[#1a1a1a] rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold">My Dashboard</h2>
          <p className="text-sm text-zinc-500 mt-1">
            Manage your agents registered on the ERC-8004 registry
          </p>
        </div>
        <button
          onClick={() => { if (window.confirm("Are you sure you want to disconnect your wallet?")) logout(); }}
          className="px-4 py-2 rounded-md text-sm font-medium text-zinc-400 hover:text-white border border-[#1f1f1f] hover:border-zinc-500 transition-colors"
        >
          Disconnect
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-[#1a1a1a] mb-6">
        <nav className="flex gap-0 -mb-px">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
                activeTab === tab.key
                  ? "text-[#00FFE0]"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {tab.label}
              {activeTab === tab.key && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00FFE0] rounded-full" />
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div>
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <StatCard label="Total Agents" value={totalAgents} />
            <StatCard
              label="Healthy Endpoints"
              value={totalEndpoints > 0 ? `${healthyEndpoints} / ${totalEndpoints}` : "—"}
            />
            <StatCard label="Total Requests" value={totalRequests.toLocaleString()} />
            <StatCard label="Total Revenue" value={`$${totalRevenue.toFixed(2)}`} sub="USDC" />
          </div>

          {/* Breakdown Charts */}
          {agents.length > 0 && (
            <div className="grid grid-cols-2 gap-4 mb-6">
              <BreakdownChart
                title="Requests by Agent"
                data={requestBarData}
                agents={chartAgents}
                total={totalRequests}
                formatValue={(v) => v.toLocaleString()}
              />
              <BreakdownChart
                title="Revenue by Agent"
                data={revenueBarData}
                agents={chartAgents}
                total={totalRevenue}
                formatValue={(v) => `$${v.toFixed(2)}`}
              />
            </div>
          )}

          {/* Agent Table */}
          <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1a1a1a] text-zinc-400">
                  <th className="text-left p-3">Agent</th>
                  <th className="text-left p-3">Chain</th>
                  <th className="text-left p-3">Requests</th>
                  <th className="text-left p-3">Customers</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">
                    <div className="flex items-center gap-1.5">
                      <span>Health</span>
                      {lastChecked && (
                        <span className="text-[10px] text-gray-600 flex items-center gap-1" title={lastChecked.toLocaleString()} suppressHydrationWarning>
                          <span className="w-3 h-3 rounded-full border border-gray-600 flex items-center justify-center text-[9px] leading-none">!</span>
                          <span suppressHydrationWarning>{lastChecked.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </span>
                      )}
                    </div>
                  </th>
                  <th className="text-left p-3"></th>
                </tr>
              </thead>
              <tbody>
                {agents.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE).map((agent) => (
                  <tr
                    key={`${agent.chain_id}-${agent.agent_id}`}
                    className={`border-b border-[#1a1a1a]/50 hover:bg-[#00FFE0]/5 ${!agent.registered ? "opacity-50 hover:opacity-80 transition-opacity" : ""}`}
                  >
                    {/* Agent name + token */}
                    <td className="p-3">
                      <div className="flex items-center gap-2.5">
                        <AgentAvatar imageUrl={agent.image_url} />
                        <div className="min-w-0">
                          <div>
                            <span className="font-medium text-gray-100">
                              {agent.name}
                            </span>
                            {agent.token_id !== null &&
                              !agent.name.startsWith("Agent #") && (
                                <span className="text-zinc-500 ml-1.5">
                                  #{agent.token_id}
                                </span>
                              )}
                          </div>
                          {!agent.registered && (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-900/30 text-yellow-500 mt-1">
                              On-chain only
                            </span>
                          )}
                          {agent.services.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {agent.services.map((svc, i) => {
                                const n = svc.toUpperCase();
                                const style = n === "MCP" ? "bg-cyan-900/30 text-cyan-400"
                                  : n === "A2A" ? "bg-emerald-900/30 text-emerald-400"
                                  : n === "WEB" || n === "HTTP" ? "bg-[#00FFE0]/10 text-[#00FFE0]"
                                  : n === "OASF" ? "bg-purple-900/30 text-purple-400"
                                  : "bg-[#141414] text-zinc-400";
                                return (
                                  <span key={i} className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${style}`}>
                                    {n}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Chain badge */}
                    <td className="p-3">
                      <ChainBadge chain={agent.chain} chainId={agent.chain_id} />
                    </td>

                    {/* Requests */}
                    <td className="p-3 text-gray-300" style={{ fontVariantNumeric: "tabular-nums" }}>{agent.total_requests.toLocaleString()}</td>

                    {/* Customers */}
                    <td className="p-3 text-gray-300" style={{ fontVariantNumeric: "tabular-nums" }}>{agent.total_customers.toLocaleString()}</td>

                    {/* Status */}
                    <td className="p-3">
                      <StatusBadge status={agent.status} />
                    </td>

                    {/* Health (per-service) */}
                    <td className="p-3">
                      {agent.registered && agent.parsed_services.some(s => s.endpoint && s.name !== "OASF" && (s.endpoint.startsWith("http://") || s.endpoint.startsWith("https://"))) ? (
                        <div className="flex flex-col gap-1">
                          {agent.parsed_services.filter(s => s.endpoint && s.name !== "OASF" && (s.endpoint.startsWith("http://") || s.endpoint.startsWith("https://"))).map((svc, i) => {
                            const key = `${agent.agent_id}:${svc.endpoint}`;
                            const status = healthStatus[key];
                            return (
                              <span key={i} className={`text-[10px] flex items-center gap-1 ${
                                status === "healthy" ? "text-green-400"
                                : status === "unhealthy" ? "text-red-400"
                                : status === "checking" ? "text-zinc-500"
                                : "text-gray-600"
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                  status === "healthy" ? "bg-green-400"
                                  : status === "unhealthy" ? "bg-red-400"
                                  : status === "checking" ? "bg-zinc-500 animate-pulse"
                                  : "bg-gray-700"
                                }`} />
                                {svc.name}
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-gray-600 text-xs">—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="p-3">
                      {agent.registered ? (
                        <Link
                          href={`/agents/${agent.agent_id}`}
                          className="text-[#00FFE0] hover:text-[#00FFE0]/80 text-xs transition-colors"
                        >
                          View
                        </Link>
                      ) : (
                        <Link
                          href={`/register?token_id=${agent.token_id}&chain_id=${agent.chain_id}&agent_uri=${encodeURIComponent(agent.agent_uri || "")}`}
                          className="inline-flex items-center px-3 py-1 rounded-md text-xs font-medium bg-green-600 hover:bg-green-500 text-white transition-colors"
                        >
                          Register →
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
                {agents.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="p-6 text-center text-gray-600"
                    >
                      No agents found. Connect your wallet or register a new agent.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {agents.length > PAGE_SIZE && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-[#1a1a1a]">
                <span className="text-xs text-zinc-500">
                  {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, agents.length)} of {agents.length} agents
                </span>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.ceil(agents.length / PAGE_SIZE) }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`min-w-[28px] h-7 rounded text-xs font-medium transition-colors ${
                        page === currentPage
                          ? "bg-[#00FFE0] text-black"
                          : "text-zinc-400 hover:bg-[#1a1a1a] hover:text-gray-200"
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "requests" && (
        <RequestsTab agents={agents} walletDaily={walletDaily} />
      )}

      {activeTab === "revenue" && (
        <RevenueTab agents={agents} />
      )}

      {activeTab === "observability" && (
        <ObservabilityTab
          agents={agents}
          healthStatus={healthStatus}
          lastChecked={lastChecked}
          walletErrors={walletErrors}
        />
      )}
    </div>
  );
}

function ChainBadge({
  chain,
  chainId,
}: {
  chain: string;
  chainId: number;
}) {
  // Color by chain
  const isBase = chainId === 84532 || chain.toLowerCase().includes("base");
  const bgColor = isBase ? "bg-[#00FFE0]/10" : "bg-purple-900/30";
  const textColor = isBase ? "text-[#00FFE0]" : "text-purple-400";

  if (chain === "-") return <span className="text-gray-600">—</span>;

  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${bgColor} ${textColor}`}
    >
      {chain}
    </span>
  );
}

interface ChartAgent {
  key: string;
  label: string;
  color: string;
}

function BreakdownChart({
  title,
  data,
  agents,
  total,
  formatValue,
}: {
  title: string;
  data: Record<string, unknown>[];
  agents: ChartAgent[];
  total: number;
  formatValue: (v: number) => string;
}) {
  return (
    <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-zinc-400">{title}</h3>
        <span className="text-sm text-gray-300 font-medium">
          {formatValue(total)}
        </span>
      </div>
      {total > 0 ? (
        <div className="rounded-md overflow-hidden">
          <ResponsiveContainer width="100%" height={32}>
            <BarChart
              layout="vertical"
              data={data}
              margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
            >
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="_" hide />
              <Tooltip
                cursor={false}
                content={({ payload }) => {
                  if (!payload?.length) return null;
                  const items = payload.filter(
                    (p) => typeof p.value === "number" && p.value > 0
                  );
                  if (!items.length) return null;
                  return (
                    <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-lg p-2.5 text-xs shadow-lg">
                      {items.map((p) => {
                        const agent = agents.find((a) => a.key === p.dataKey);
                        const val = p.value as number;
                        const pct =
                          total > 0 ? ((val / total) * 100).toFixed(1) : "0";
                        return (
                          <div
                            key={String(p.dataKey)}
                            className="flex items-center gap-2 py-0.5"
                          >
                            <div
                              className="w-2.5 h-2.5 rounded-sm shrink-0"
                              style={{ backgroundColor: agent?.color }}
                            />
                            <span className="text-gray-300">
                              {agent?.label}
                            </span>
                            <span className="text-zinc-500 ml-auto pl-3">
                              {formatValue(val)} ({pct}%)
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                }}
              />
              {agents.map((a) => (
                <Bar
                  key={a.key}
                  dataKey={a.key}
                  stackId="stack"
                  fill={a.color}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-8 bg-[#141414]/50 rounded flex items-center justify-center">
          <span className="text-xs text-gray-600">No data</span>
        </div>
      )}
      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
        {agents.map((a) => {
          const val = (data[0]?.[a.key] as number) || 0;
          return (
            <div key={a.key} className="flex items-center gap-1.5 text-xs">
              <div
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: a.color }}
              />
              <span className="text-zinc-400">{a.label}</span>
              <span className="text-gray-600">{formatValue(val)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "bg-green-900/30 text-green-400",
    inactive: "bg-[#141414] text-zinc-400",
    deregistered: "bg-red-900/30 text-red-400",
  };

  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
        colors[status] || colors.inactive
      }`}
    >
      {status}
    </span>
  );
}
