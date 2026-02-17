"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useNetworkAgents, useNetworkStats, useOverview } from "@/lib/hooks";
import { StatCard } from "@/components/StatCard";
import { NETWORKS, NETWORK_LIST } from "@/lib/networks";
import { AgentAvatar } from "@/components/RobotIcon";
import { openApi } from "@/lib/api";
import type { NetworkAgent } from "@/lib/api";
import { useAuth } from "@/lib/auth";

// Chain ID → display name
const CHAIN_NAMES: Record<number, string> = {};
for (const n of NETWORK_LIST) {
  CHAIN_NAMES[n.chainId] = n.shortName;
}

// Chain ID → route key
const CHAIN_ID_TO_KEY: Record<number, string> = {};
for (const [key, cfg] of Object.entries(NETWORKS)) {
  CHAIN_ID_TO_KEY[cfg.chainId] = key;
}

const PAGE_SIZE = 20;

const TABS = [
  { label: "All", chainId: 0 },
  ...NETWORK_LIST.map((n) => ({ label: n.shortName, chainId: n.chainId })),
];

type PlatformData = {
  agent_id: string;
  status: string;
  total_requests: number;
  total_revenue_usdc: number;
  total_customers: number;
  protocols: string[];
  reputation_score?: number;
};

export default function ExplorerPage() {
  return (
    <Suspense fallback={<p className="text-zinc-500">Loading&hellip;</p>}>
      <ExplorerContent />
    </Suspense>
  );
}

function ExplorerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { walletAddress } = useAuth();

  const [chainFilter, setChainFilter] = useState(() => Number(searchParams.get("chain") || 0));
  const [search, setSearch] = useState(() => searchParams.get("q") || "");
  const [page, setPage] = useState(() => Number(searchParams.get("page") || 1));
  const [platformOnly, setPlatformOnly] = useState(() => searchParams.get("platform") === "1");
  const [mineOnly, setMineOnly] = useState(() => searchParams.get("mine") === "1");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">(() =>
    (searchParams.get("sort") as "newest" | "oldest") || "newest"
  );

  const syncUrl = useCallback((params: Record<string, string | number>) => {
    const sp = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(params)) {
      const str = String(v);
      if (!str || str === "0" || (str === "1" && k === "page")) sp.delete(k);
      else sp.set(k, str);
    }
    router.replace(`?${sp.toString()}`, { scroll: false });
  }, [searchParams, router]);

  const handleChainFilter = (chainId: number) => {
    setChainFilter(chainId);
    setPlatformOnly(false);
    setPage(1);
    syncUrl({ chain: chainId, platform: 0, page: 1 });
  };
  const handleSearch = (val: string) => {
    setSearch(val);
    setPage(1);
    syncUrl({ q: val, page: 1 });
  };
  const handlePlatformToggle = () => {
    const next = !platformOnly;
    setPlatformOnly(next);
    setPage(1);
    syncUrl({ platform: next ? 1 : 0, page: 1 });
  };
  const handleMineToggle = () => {
    const next = !mineOnly;
    setMineOnly(next);
    setPage(1);
    syncUrl({ mine: next ? 1 : 0, page: 1 });
  };
  const handleSortToggle = () => {
    const next = sortOrder === "newest" ? "oldest" : "newest";
    setSortOrder(next);
    setPage(1);
    syncUrl({ sort: next, page: 1 });
  };

  // On-chain agents (primary data source)
  const { data, loading } = useNetworkAgents({
    chain_id: chainFilter || undefined,
    search: search || undefined,
    owner: mineOnly && walletAddress ? walletAddress : undefined,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
    sort: sortOrder,
  });
  const { data: stats } = useNetworkStats();
  const { data: overview } = useOverview();

  // Platform-registered agents (enrichment)
  const [platformMap, setPlatformMap] = useState<Map<string, PlatformData>>(
    new Map()
  );
  useEffect(() => {
    const supportedChainIds = new Set(NETWORK_LIST.map((n) => n.chainId));
    openApi
      .searchAgents()
      .then(async (res) => {
        const candidates: Array<{ key: string; data: PlatformData }> = [];
        for (const a of res.agents || []) {
          if (a.erc8004_token_id != null && a.chain_id != null && supportedChainIds.has(a.chain_id)) {
            candidates.push({
              key: `${a.chain_id}-${a.erc8004_token_id}`,
              data: {
                agent_id: a.agent_id,
                status: a.status,
                total_requests: a.total_requests,
                total_revenue_usdc: a.total_revenue_usdc,
                total_customers: a.total_customers,
                protocols: a.protocols || [],
                reputation_score: a.reputation_score,
              },
            });
          }
        }
        // Verify each candidate exists on-chain via discovery service
        const verified = await Promise.all(
          candidates.map(({ key }) => {
            const [cid, tid] = key.split("-");
            return openApi
              .getNetworkAgent(Number(cid), Number(tid))
              .then(() => true)
              .catch(() => false);
          })
        );
        const map = new Map<string, PlatformData>();
        candidates.forEach((c, i) => {
          if (verified[i]) map.set(c.key, c.data);
        });
        setPlatformMap(map);
      })
      .catch(() => {});
  }, []);

  // Fetch full NetworkAgent data for platform-registered agents
  const [platformAgents, setPlatformAgents] = useState<NetworkAgent[]>([]);
  useEffect(() => {
    if (!platformOnly || platformMap.size === 0) {
      setPlatformAgents([]);
      return;
    }
    const entries = [...platformMap.entries()];
    Promise.all(
      entries.map(([key]) => {
        const [cid, tid] = key.split("-");
        return openApi.getNetworkAgent(Number(cid), Number(tid)).catch(() => null);
      })
    ).then((results) => {
      setPlatformAgents(results.filter((r): r is NetworkAgent => r !== null));
    });
  }, [platformOnly, platformMap]);

  const sortedAgents = (agents: NetworkAgent[]) => {
    const sorted = [...agents];
    sorted.sort((a, b) =>
      sortOrder === "newest"
        ? b.token_id - a.token_id
        : a.token_id - b.token_id
    );
    return sorted;
  };
  const displayAgents: NetworkAgent[] = platformOnly
    ? sortedAgents(platformAgents)
    : (data?.agents ?? []);
  const totalRows = platformOnly ? platformAgents.length : (data?.total ?? 0);
  const totalPages = platformOnly ? 1 : Math.max(1, Math.ceil(totalRows / PAGE_SIZE));

  const total = stats?.total ?? 0;
  const chainCounts = stats?.by_chain ?? {};
  const registeredCount = platformMap.size;

  const handleAgentClick = (agent: NetworkAgent) => {
    const chainKey =
      CHAIN_ID_TO_KEY[agent.chain_id] || String(agent.chain_id);
    router.push(`/discovery/${chainKey}/${agent.token_id}`);
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold">Agent Explorer</h2>
        <p className="text-sm text-zinc-500 mt-1">
          All ERC-8004 agents across supported networks
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <StatCard
          label="On-chain Agents"
          value={total}
          sub={`${registeredCount} on GT8004`}
        />
        <StatCard
          label="Total Requests"
          value={overview?.total_requests.toLocaleString() ?? "0"}
          sub={`${overview?.today_requests.toLocaleString() ?? "0"} today`}
        />
        <StatCard
          label="Total Revenue"
          value={`$${overview?.total_revenue_usdc.toFixed(2) ?? "0.00"}`}
          sub="USDC"
        />
      </div>

      {/* Chain Tabs + Search */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-1">
          {TABS.map((tab) => {
            const count =
              tab.chainId === 0 ? total : (chainCounts[tab.chainId] ?? 0);
            const active = !platformOnly && chainFilter === tab.chainId;
            return (
              <button
                key={tab.chainId}
                onClick={() => handleChainFilter(tab.chainId)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-[#00FFE0]/10 text-[#00FFE0] border border-[#00FFE0]/30"
                    : "bg-[#141414] text-zinc-400 hover:bg-[#1a1a1a] hover:text-zinc-200"
                }`}
              >
                {tab.label}
                <span
                  className={`ml-1.5 text-xs ${
                    active ? "text-[#00FFE0]/70" : "text-zinc-500"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
          {registeredCount > 0 && (
            <button
              onClick={handlePlatformToggle}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                platformOnly
                  ? "bg-[#00FFE0] text-black"
                  : "bg-[#141414] text-zinc-400 hover:bg-[#1a1a1a] hover:text-zinc-200"
              }`}
            >
              GT8004
              <span
                className={`ml-1.5 text-xs ${
                  platformOnly ? "text-black/70" : "text-zinc-500"
                }`}
              >
                {registeredCount}
              </span>
            </button>
          )}
          {walletAddress && (
            <button
              onClick={handleMineToggle}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                mineOnly
                  ? "bg-[#00FFE0] text-black"
                  : "bg-[#141414] text-zinc-400 hover:bg-[#1a1a1a] hover:text-zinc-200"
              }`}
            >
              Mine
            </button>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={handleSortToggle}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-zinc-400 bg-[#141414] hover:bg-[#1a1a1a] hover:text-zinc-200 transition-colors"
          >
            <svg
              className={`w-3.5 h-3.5 transition-transform ${sortOrder === "oldest" ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
            {sortOrder === "newest" ? "Newest" : "Oldest"}
          </button>
          <span className="text-xs text-zinc-500">
            {totalRows} agents
          </span>
        </div>
      </div>

      <div className="mb-4">
        <input
          type="text"
          name="search"
          placeholder="Search by name, owner, or token ID\u2026"
          aria-label="Search agents"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full px-3 py-2 bg-[#141414] border border-[#1f1f1f] rounded-md text-sm text-[#ededed] placeholder-zinc-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00FFE0]/30 focus-visible:border-[#00FFE0]/50"
        />
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-zinc-500">Loading\u2026</p>
      ) : (
        <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1a1a1a] text-zinc-400">
                <th className="text-left p-3">Agent</th>
                <th className="text-left p-3">Network</th>
                <th className="text-left p-3">Services</th>
                <th className="text-center p-3">x402</th>
                <th className="text-left p-3">GT8004</th>
                <th className="text-right p-3">Requests</th>
                <th className="text-right p-3">Revenue</th>
                <th className="text-left p-3">Owner</th>
              </tr>
            </thead>
            <tbody>
              {displayAgents.map((agent) => {
                const key = `${agent.chain_id}-${agent.token_id}`;
                const platform = platformMap.get(key);
                return (
                  <tr
                    key={key}
                    role="link"
                    tabIndex={0}
                    onClick={() => handleAgentClick(agent)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleAgentClick(agent); } }}
                    className="border-b border-[#1a1a1a]/50 hover:bg-[#00FFE0]/5 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00FFE0]/30"
                  >
                    {/* Agent */}
                    <td className="p-3">
                      <div className="flex items-center gap-2.5">
                        <AgentAvatar imageUrl={agent.image_url} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-[#ededed]">
                              {agent.name || `Agent #${agent.token_id}`}
                            </span>
                            {agent.name && (
                              <span className="text-zinc-600 text-xs">
                                #{agent.token_id}
                              </span>
                            )}
                          </div>
                          {agent.description && (
                            <p className="text-xs text-zinc-600 truncate max-w-[280px] mt-0.5">
                              {agent.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Network */}
                    <td className="p-3">
                      <ChainBadge chainId={agent.chain_id} />
                    </td>

                    {/* Services */}
                    <td className="p-3">
                      <ServiceBadges agent={agent} platform={platform} />
                    </td>

                    {/* x402 */}
                    <td className="p-3 text-center">
                      {agent.metadata?.x402Support || agent.metadata?.x402support ? (
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-900/30 text-amber-400">
                          x402
                        </span>
                      ) : (
                        <span className="text-zinc-700 text-xs">—</span>
                      )}
                    </td>

                    {/* Platform */}
                    <td className="p-3">
                      {platform ? (
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-[#00FFE0]/10 text-[#00FFE0]">
                          {platform.status === "active" ? "Active" : platform.status}
                        </span>
                      ) : (
                        <span className="text-zinc-700 text-xs">—</span>
                      )}
                    </td>

                    {/* Requests */}
                    <td className="p-3 text-right" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {platform ? (
                        <span className="text-gray-300">
                          {platform.total_requests.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-zinc-700">—</span>
                      )}
                    </td>

                    {/* Revenue */}
                    <td className="p-3 text-right" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {platform && platform.total_revenue_usdc > 0 ? (
                        <span className="text-gray-300">
                          ${platform.total_revenue_usdc.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-zinc-700">—</span>
                      )}
                    </td>

                    {/* Owner */}
                    <td className="p-3">
                      {agent.owner_address ? (
                        <AddressCell address={agent.owner_address} />
                      ) : (
                        <span className="text-zinc-700 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {displayAgents.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-zinc-600">
                    No agents found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-[#1a1a1a]">
              <span className="text-xs text-zinc-500">
                {(page - 1) * PAGE_SIZE + 1}–
                {Math.min(page * PAGE_SIZE, totalRows)} of {totalRows}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { const p = Math.max(1, page - 1); setPage(p); syncUrl({ page: p }); }}
                  disabled={page === 1}
                  className="px-2 py-1 rounded text-xs text-zinc-400 hover:bg-[#141414] disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Prev
                </button>
                {pageNumbers(page, totalPages).map((p, i) =>
                  p === -1 ? (
                    <span
                      key={`dots-${i}`}
                      className="px-1 text-xs text-zinc-600"
                    >
                      &hellip;
                    </span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => { setPage(p); syncUrl({ page: p }); }}
                      className={`min-w-[28px] px-1.5 py-1 rounded text-xs font-medium ${
                        p === page
                          ? "bg-[#00FFE0] text-black"
                          : "text-zinc-400 hover:bg-[#141414]"
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}
                <button
                  onClick={() => { const p = Math.min(totalPages, page + 1); setPage(p); syncUrl({ page: p }); }}
                  disabled={page === totalPages}
                  className="px-2 py-1 rounded text-xs text-zinc-400 hover:bg-[#141414] disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Helper Components ---

function AddressCell({ address }: { address: string }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const truncated = `${address.slice(0, 6)}\u2026${address.slice(-4)}`;

  return (
    <button
      type="button"
      className="relative text-xs font-mono text-zinc-400 cursor-pointer hover:text-zinc-200 transition-colors bg-transparent border-none p-0"
      onClick={(e) => {
        e.stopPropagation();
        setShowTooltip((prev) => !prev);
      }}
      onBlur={() => setShowTooltip(false)}
      onMouseLeave={() => setShowTooltip(false)}
      aria-label={`Show full address: ${address}`}
    >
      {truncated}
      {showTooltip && (
        <span className="absolute z-50 left-0 top-full mt-1 px-3 py-2 bg-[#141414] border border-[#1f1f1f] rounded-lg shadow-lg text-xs font-mono text-gray-200 whitespace-nowrap">
          {address}
        </span>
      )}
    </button>
  );
}

function ChainBadge({ chainId }: { chainId: number }) {
  const isPrimary = chainId === NETWORK_LIST[0]?.chainId;
  const name = CHAIN_NAMES[chainId] || `Chain ${chainId}`;
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
        isPrimary
          ? "bg-[#00FFE0]/10 text-[#00FFE0]"
          : "bg-purple-900/30 text-purple-400"
      }`}
    >
      {name}
    </span>
  );
}

const SVC_STYLE: Record<string, string> = {
  MCP: "bg-cyan-900/30 text-cyan-400",
  A2A: "bg-emerald-900/30 text-emerald-400",
  WEB: "bg-blue-900/30 text-blue-400",
  HTTP: "bg-blue-900/30 text-blue-400",
  OASF: "bg-purple-900/30 text-purple-400",
};

function ServiceBadges({
  agent,
  platform,
}: {
  agent: NetworkAgent;
  platform?: PlatformData;
}) {
  // Merge on-chain services + platform protocols (x402 shown in separate column)
  const names = new Set<string>();
  const svcs =
    agent.metadata?.services ?? agent.metadata?.endpoints ?? [];
  for (const s of svcs) {
    const n = (s as { name?: string }).name?.toUpperCase();
    if (n && n !== "X402") names.add(n);
  }
  if (platform) {
    for (const p of platform.protocols) {
      names.add(p.toUpperCase());
    }
  }

  if (names.size === 0) return <span className="text-zinc-700 text-xs">—</span>;

  return (
    <div className="flex flex-wrap gap-1">
      {[...names].map((n) => (
        <span
          key={n}
          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
            SVC_STYLE[n] || "bg-[#141414] text-zinc-400"
          }`}
        >
          {n}
        </span>
      ))}
    </div>
  );
}

/** Generate page numbers with ellipsis */
function pageNumbers(current: number, total: number): number[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: number[] = [1];
  if (current > 3) pages.push(-1);
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (current < total - 2) pages.push(-1);
  pages.push(total);
  return pages;
}
