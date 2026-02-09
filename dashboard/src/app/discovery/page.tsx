"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useNetworkAgents, useNetworkStats } from "@/lib/hooks";
import { NETWORKS, NETWORK_LIST } from "@/lib/networks";
import type { NetworkAgent } from "@/lib/api";

// Chain ID → display name mapping
const CHAIN_NAMES: Record<number, string> = {};
for (const n of NETWORK_LIST) {
  CHAIN_NAMES[n.chainId] = n.shortName;
}

// Chain ID → route key mapping
const CHAIN_ID_TO_KEY: Record<number, string> = {};
for (const [key, cfg] of Object.entries(NETWORKS)) {
  CHAIN_ID_TO_KEY[cfg.chainId] = key;
}

const PAGE_SIZE = 20;

const TABS = [
  { label: "Total", chainId: 0 },
  ...NETWORK_LIST.map((n) => ({ label: n.shortName, chainId: n.chainId })),
];

export default function DiscoveryPage() {
  const router = useRouter();
  const [chainFilter, setChainFilter] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // Reset to page 1 when filter/search changes
  const handleChainFilter = (chainId: number) => {
    setChainFilter(chainId);
    setPage(1);
  };
  const handleSearch = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  const { data, loading } = useNetworkAgents({
    chain_id: chainFilter || undefined,
    search: search || undefined,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  const { data: stats } = useNetworkStats();

  const agents: NetworkAgent[] = data?.agents ?? [];
  const totalRows = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));

  const total = stats?.total ?? 0;
  const chainCounts = stats?.by_chain ?? {};

  const handleAgentClick = (agent: NetworkAgent) => {
    const chainKey = CHAIN_ID_TO_KEY[agent.chain_id] || String(agent.chain_id);
    router.push(`/discovery/${chainKey}/${agent.token_id}`);
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold">Agent Registry</h2>
        <p className="text-sm text-gray-500 mt-1">
          All ERC-8004 agents discovered on-chain
        </p>
      </div>

      {/* Chain Tabs */}
      <div className="flex items-center gap-1 mb-6">
        {TABS.map((tab) => {
          const count =
            tab.chainId === 0 ? total : (chainCounts[tab.chainId] ?? 0);
          const active = chainFilter === tab.chainId;
          return (
            <button
              key={tab.chainId}
              onClick={() => handleChainFilter(tab.chainId)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
              }`}
            >
              {tab.label}
              <span
                className={`ml-2 text-xs ${
                  active ? "text-blue-200" : "text-gray-500"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search by name, owner, URI, or token ID..."
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
                <th className="text-left p-3">Name</th>
                <th className="text-left p-3">Chain</th>
                <th className="text-left p-3">Owner</th>
                <th className="text-left p-3">Agent URI</th>
                <th className="text-left p-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr
                  key={`${agent.chain_id}-${agent.token_id}`}
                  onClick={() => handleAgentClick(agent)}
                  className="border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer"
                >
                  {/* Name */}
                  <td className="p-3">
                    <div>
                      <span className="font-medium text-gray-100">
                        {agent.name || `Token #${agent.token_id}`}
                      </span>
                      {agent.name && (
                        <span className="text-gray-500 ml-1.5">
                          #{agent.token_id}
                        </span>
                      )}
                    </div>
                    {agent.description && (
                      <p className="text-xs text-gray-600 truncate max-w-[250px] mt-0.5">
                        {agent.description}
                      </p>
                    )}
                  </td>

                  {/* Chain */}
                  <td className="p-3">
                    <ChainBadge chainId={agent.chain_id} />
                  </td>

                  {/* Owner */}
                  <td className="p-3">
                    <span className="font-mono text-xs text-gray-400">
                      {agent.owner_address
                        ? `${agent.owner_address.slice(0, 6)}...${agent.owner_address.slice(-4)}`
                        : "—"}
                    </span>
                  </td>

                  {/* Agent URI */}
                  <td className="p-3">
                    {agent.agent_uri ? (
                      <span className="text-xs text-gray-400 truncate block max-w-[200px]">
                        {agent.agent_uri}
                      </span>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>

                  {/* Created */}
                  <td className="p-3 text-gray-400 text-xs">
                    {agent.created_at
                      ? new Date(agent.created_at).toLocaleDateString()
                      : "—"}
                  </td>
                </tr>
              ))}
              {agents.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="p-6 text-center text-gray-600"
                  >
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
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalRows)} of {totalRows}
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
                    <span key={`dots-${i}`} className="px-1 text-xs text-gray-600">
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
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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

/** Generate page numbers with ellipsis: [1, 2, 3, -1, 28, 29] */
function pageNumbers(current: number, total: number): number[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: number[] = [];
  pages.push(1);

  if (current > 3) pages.push(-1);

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);

  if (current < total - 2) pages.push(-1);

  pages.push(total);
  return pages;
}

function ChainBadge({ chainId }: { chainId: number }) {
  const isBase = chainId === 84532;
  const name = CHAIN_NAMES[chainId] || `Chain ${chainId}`;
  const bgColor = isBase ? "bg-blue-900/30" : "bg-purple-900/30";
  const textColor = isBase ? "text-blue-400" : "text-purple-400";

  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${bgColor} ${textColor}`}
    >
      {name}
    </span>
  );
}
