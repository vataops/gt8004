"use client";

import { useState, useEffect, useCallback } from "react";
import { StatCard } from "@/components/StatCard";
import { useNetworkAgents, useNetworkStats } from "@/lib/hooks";
import { fetchScanAgents, type NetworkAgent, type ScanAgent } from "@/lib/api";
import { NETWORK_LIST } from "@/lib/networks";

// Chain ID → display name mapping
const CHAIN_NAMES: Record<number, string> = {};
for (const n of NETWORK_LIST) {
  CHAIN_NAMES[n.chainId] = n.shortName;
}

interface EnrichedAgent extends NetworkAgent {
  scan?: ScanAgent;
}

export default function DiscoveryPage() {
  const [chainFilter, setChainFilter] = useState(0);
  const [search, setSearch] = useState("");
  const [enriched, setEnriched] = useState<EnrichedAgent[]>([]);

  const { data, loading } = useNetworkAgents({
    chain_id: chainFilter || undefined,
    search: search || undefined,
    limit: 200,
  });
  const { data: stats } = useNetworkStats();

  // Enrich with 8004scan metadata
  const enrich = useCallback(async (agents: NetworkAgent[]) => {
    if (agents.length === 0) {
      setEnriched([]);
      return;
    }

    const tokens = agents.map((a) => ({
      token_id: a.token_id,
      chain_id: a.chain_id,
    }));
    const scanData = await fetchScanAgents(tokens);

    setEnriched(
      agents.map((a) => ({
        ...a,
        scan: scanData.get(`${a.chain_id}-${a.token_id}`),
      }))
    );
  }, []);

  useEffect(() => {
    if (data?.agents) {
      enrich(data.agents);
    }
  }, [data?.agents, enrich]);

  const total = stats?.total ?? 0;
  const chainCounts = stats?.by_chain ?? {};

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold">Agent Registry</h2>
        <p className="text-sm text-gray-500 mt-1">
          All ERC-8004 agents discovered on-chain
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Agents" value={total} />
        {NETWORK_LIST.map((n) => (
          <StatCard
            key={n.chainId}
            label={n.shortName}
            value={chainCounts[n.chainId] ?? 0}
          />
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <input
          type="text"
          placeholder="Search by owner, URI, or token ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <select
          value={chainFilter}
          onChange={(e) => setChainFilter(Number(e.target.value))}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value={0}>All Chains</option>
          {NETWORK_LIST.map((n) => (
            <option key={n.chainId} value={n.chainId}>
              {n.shortName}
            </option>
          ))}
        </select>
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
                <th className="text-left p-3">Score</th>
                <th className="text-left p-3">Feedback</th>
                <th className="text-left p-3">Owner</th>
                <th className="text-left p-3">Agent URI</th>
                <th className="text-left p-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {enriched.map((agent) => (
                <tr
                  key={`${agent.chain_id}-${agent.token_id}`}
                  className="border-b border-gray-800/50 hover:bg-gray-800/30"
                >
                  {/* Name */}
                  <td className="p-3">
                    <div>
                      <span className="font-medium text-gray-100">
                        {agent.scan?.name || `Token #${agent.token_id}`}
                      </span>
                      {agent.scan?.name && (
                        <span className="text-gray-500 ml-1.5">
                          #{agent.token_id}
                        </span>
                      )}
                    </div>
                    {agent.scan?.description && (
                      <p className="text-xs text-gray-600 truncate max-w-[250px] mt-0.5">
                        {agent.scan.description}
                      </p>
                    )}
                  </td>

                  {/* Chain */}
                  <td className="p-3">
                    <ChainBadge chainId={agent.chain_id} />
                  </td>

                  {/* Score */}
                  <td className="p-3 text-gray-300">
                    {agent.scan
                      ? agent.scan.total_score > 0
                        ? agent.scan.total_score.toFixed(1)
                        : "0"
                      : "—"}
                  </td>

                  {/* Feedback */}
                  <td className="p-3 text-gray-300">
                    {agent.scan?.total_feedbacks ?? "—"}
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
                    {agent.scan?.created_at
                      ? new Date(agent.scan.created_at).toLocaleDateString()
                      : agent.created_at
                        ? new Date(agent.created_at).toLocaleDateString()
                        : "—"}
                  </td>
                </tr>
              ))}
              {enriched.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="p-6 text-center text-gray-600"
                  >
                    No agents found. Agents will appear after the sync job
                    discovers on-chain tokens.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
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
