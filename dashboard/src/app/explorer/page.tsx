"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useNetworkAgents, useNetworkStats, useOverview } from "@/lib/hooks";
import { StatCard } from "@/components/StatCard";
import { NETWORKS, NETWORK_LIST, resolveImageUrl } from "@/lib/networks";
import { openApi } from "@/lib/api";
import type { NetworkAgent } from "@/lib/api";

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
  const router = useRouter();
  const [chainFilter, setChainFilter] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [platformOnly, setPlatformOnly] = useState(false);

  const handleChainFilter = (chainId: number) => {
    setChainFilter(chainId);
    setPlatformOnly(false);
    setPage(1);
  };
  const handleSearch = (val: string) => {
    setSearch(val);
    setPage(1);
  };
  const handlePlatformToggle = () => {
    setPlatformOnly((prev) => !prev);
    setPage(1);
  };

  // On-chain agents (primary data source)
  const { data, loading } = useNetworkAgents({
    chain_id: chainFilter || undefined,
    search: search || undefined,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  const { data: stats } = useNetworkStats();
  const { data: overview } = useOverview();

  // Platform-registered agents (enrichment)
  const [platformMap, setPlatformMap] = useState<Map<string, PlatformData>>(
    new Map()
  );
  useEffect(() => {
    openApi
      .searchAgents()
      .then((res) => {
        const map = new Map<string, PlatformData>();
        for (const a of res.agents || []) {
          if (a.erc8004_token_id != null && a.chain_id != null) {
            map.set(`${a.chain_id}-${a.erc8004_token_id}`, {
              agent_id: a.agent_id,
              status: a.status,
              total_requests: a.total_requests,
              total_revenue_usdc: a.total_revenue_usdc,
              total_customers: a.total_customers,
              protocols: a.protocols || [],
              reputation_score: a.reputation_score,
            });
          }
        }
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

  const displayAgents: NetworkAgent[] = platformOnly ? platformAgents : (data?.agents ?? []);
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
        <p className="text-sm text-gray-500 mt-1">
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
                    ? "bg-blue-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
                }`}
              >
                {tab.label}
                <span
                  className={`ml-1.5 text-xs ${
                    active ? "text-blue-200" : "text-gray-500"
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
                  ? "bg-green-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
              }`}
            >
              GT8004
              <span
                className={`ml-1.5 text-xs ${
                  platformOnly ? "text-green-200" : "text-gray-500"
                }`}
              >
                {registeredCount}
              </span>
            </button>
          )}
        </div>
        <span className="text-xs text-gray-500 shrink-0">
          {totalRows} agents
        </span>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name, owner, or token ID..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500">
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
                    onClick={() => handleAgentClick(agent)}
                    className="border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer"
                  >
                    {/* Agent */}
                    <td className="p-3">
                      <div className="flex items-center gap-2.5">
                        {resolveImageUrl(agent.image_url) ? (
                          <img
                            src={resolveImageUrl(agent.image_url)!}
                            alt=""
                            className="w-8 h-8 rounded-md object-cover bg-gray-800 shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-md bg-gray-800 flex items-center justify-center text-xs text-gray-600 shrink-0">
                            #
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-gray-100">
                              {agent.name || `Token #${agent.token_id}`}
                            </span>
                            {agent.name && (
                              <span className="text-gray-600 text-xs">
                                #{agent.token_id}
                              </span>
                            )}
                          </div>
                          {agent.description && (
                            <p className="text-xs text-gray-600 truncate max-w-[280px] mt-0.5">
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
                        <span className="text-gray-700 text-xs">—</span>
                      )}
                    </td>

                    {/* Platform */}
                    <td className="p-3">
                      {platform ? (
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-green-900/30 text-green-400">
                          {platform.status === "active" ? "Active" : platform.status}
                        </span>
                      ) : (
                        <span className="text-gray-700 text-xs">—</span>
                      )}
                    </td>

                    {/* Requests */}
                    <td className="p-3 text-right">
                      {platform ? (
                        <span className="text-gray-300">
                          {platform.total_requests.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-gray-700">—</span>
                      )}
                    </td>

                    {/* Revenue */}
                    <td className="p-3 text-right">
                      {platform && platform.total_revenue_usdc > 0 ? (
                        <span className="text-gray-300">
                          ${platform.total_revenue_usdc.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-gray-700">—</span>
                      )}
                    </td>

                    {/* Owner */}
                    <td className="p-3">
                      {agent.owner_address ? (
                        <AddressCell address={agent.owner_address} />
                      ) : (
                        <span className="text-gray-700 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {displayAgents.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-gray-600">
                    No agents found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
              <span className="text-xs text-gray-500">
                {(page - 1) * PAGE_SIZE + 1}–
                {Math.min(page * PAGE_SIZE, totalRows)} of {totalRows}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-2 py-1 rounded text-xs text-gray-400 hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Prev
                </button>
                {pageNumbers(page, totalPages).map((p, i) =>
                  p === -1 ? (
                    <span
                      key={`dots-${i}`}
                      className="px-1 text-xs text-gray-600"
                    >
                      ...
                    </span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`min-w-[28px] px-1.5 py-1 rounded text-xs font-medium ${
                        p === page
                          ? "bg-blue-600 text-white"
                          : "text-gray-400 hover:bg-gray-800"
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}
                <button
                  onClick={() =>
                    setPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={page === totalPages}
                  className="px-2 py-1 rounded text-xs text-gray-400 hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed"
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
  const truncated = `${address.slice(0, 6)}...${address.slice(-4)}`;

  return (
    <span
      className="relative text-xs font-mono text-gray-400 cursor-pointer hover:text-gray-200 transition-colors"
      onClick={(e) => {
        e.stopPropagation();
        setShowTooltip((prev) => !prev);
      }}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {truncated}
      {showTooltip && (
        <span className="absolute z-50 left-0 top-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg shadow-lg text-xs font-mono text-gray-200 whitespace-nowrap">
          {address}
        </span>
      )}
    </span>
  );
}

function ChainBadge({ chainId }: { chainId: number }) {
  const isBase = chainId === 84532;
  const name = CHAIN_NAMES[chainId] || `Chain ${chainId}`;
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
        isBase
          ? "bg-blue-900/30 text-blue-400"
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

  if (names.size === 0) return <span className="text-gray-700 text-xs">—</span>;

  return (
    <div className="flex flex-wrap gap-1">
      {[...names].map((n) => (
        <span
          key={n}
          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
            SVC_STYLE[n] || "bg-gray-800 text-gray-400"
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
