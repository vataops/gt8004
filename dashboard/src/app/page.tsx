"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useOverview, useAgents } from "@/lib/hooks";
import { StatCard } from "@/components/StatCard";
import { DataTable, type Column } from "@/components/DataTable";
import type { Agent } from "@/lib/api";
import { NETWORK_LIST, resolveImageUrl, parseAgentURIImage } from "@/lib/networks";

function getChainName(chainId: number): string {
  const net = NETWORK_LIST.find((n) => n.chainId === chainId);
  return net?.shortName ?? "";
}

const PROTOCOL_COLORS: Record<string, string> = {
  MCP: "bg-blue-500",
  A2A: "bg-purple-500",
  OASF: "bg-green-500",
  HTTP: "bg-gray-500",
};

const PROTOCOL_TEXT_COLORS: Record<string, string> = {
  MCP: "text-blue-400",
  A2A: "text-purple-400",
  OASF: "text-green-400",
  HTTP: "text-gray-400",
};

const agentColumns: Column<Agent>[] = [
  {
    key: "name",
    header: "Agent",
    render: (row) => {
      const hasOnChainId = row.erc8004_token_id != null && row.chain_id != null;
      const imgUrl = resolveImageUrl(row.image_url ?? parseAgentURIImage(row.agent_uri));
      const content = (
        <div className="flex items-center gap-2.5">
          {imgUrl ? (
            <img
              src={imgUrl}
              alt=""
              className="w-8 h-8 rounded-md object-cover bg-gray-800 shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-md bg-gray-800 flex items-center justify-center text-xs text-gray-600 shrink-0">
              #
            </div>
          )}
          <div className="min-w-0">
            <span className="font-medium text-white">
              {row.name || (row.erc8004_token_id != null ? `Token #${row.erc8004_token_id}` : row.agent_id)}
            </span>
            {row.erc8004_token_id != null && (
              <p className="text-xs text-gray-500 mt-0.5">
                #{row.erc8004_token_id}
              </p>
            )}
          </div>
        </div>
      );

      if (hasOnChainId) {
        return (
          <Link
            href={`/discovery/${row.chain_id}/${row.erc8004_token_id}`}
            className="hover:opacity-70 transition-opacity"
          >
            {content}
          </Link>
        );
      }

      return content;
    },
  },
  {
    key: "chain_id",
    header: "Network",
    render: (row) => {
      const chainId = row.chain_id ?? 0;
      const chainName = getChainName(chainId);
      if (!chainId || !chainName)
        return <span className="text-gray-600">-</span>;
      const isBase = chainId === 84532;
      return (
        <span
          className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
            isBase
              ? "bg-blue-900/30 text-blue-400"
              : "bg-purple-900/30 text-purple-400"
          }`}
        >
          {chainName}
        </span>
      );
    },
  },
  {
    key: "protocols",
    header: "Protocols",
    render: (row) => (
      <div className="flex gap-1 flex-wrap">
        {(row.protocols || []).map((p: string) => (
          <span
            key={p}
            className="px-1.5 py-0.5 rounded text-xs bg-blue-900/30 text-blue-400"
          >
            {p}
          </span>
        ))}
      </div>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: (row) => (
      <span
        className={`px-2 py-0.5 rounded text-xs ${
          row.status === "active"
            ? "bg-green-900/30 text-green-400"
            : "bg-gray-700/30 text-gray-400"
        }`}
      >
        {row.status}
      </span>
    ),
  },
  {
    key: "total_requests",
    header: "Requests",
    render: (row) => row.total_requests?.toLocaleString() ?? "0",
  },
  {
    key: "total_customers",
    header: "Customers",
    render: (row) =>
      row.total_customers ? row.total_customers.toLocaleString() : "-",
  },
  {
    key: "total_revenue_usdc",
    header: "Revenue",
    render: (row) =>
      row.total_revenue_usdc ? `$${row.total_revenue_usdc.toFixed(2)}` : "-",
  },
  {
    key: "reputation_score",
    header: "Reputation",
    render: (row) =>
      row.reputation_score != null ? (
        <span className="text-yellow-400 font-medium">
          {row.reputation_score.toFixed(1)}
        </span>
      ) : (
        <span className="text-gray-600">-</span>
      ),
  },
  {
    key: "avg_response_ms",
    header: "Avg Latency",
    render: (row) =>
      row.avg_response_ms ? `${row.avg_response_ms.toFixed(0)}ms` : "-",
  },
];

export default function OverviewPage() {
  const { data: overview, loading } = useOverview();
  const { data: agentsData } = useAgents();
  const [chainFilter, setChainFilter] = useState<number | null>(null);

  const agents = agentsData?.agents || [];

  // Filtered agents
  const filteredAgents = chainFilter
    ? agents.filter((a) => (a.chain_id ?? 0) === chainFilter)
    : agents;

  const activeCount = filteredAgents.filter(
    (a) => a.status === "active"
  ).length;

  // Available chains for filter (only chains that have agents)
  const availableChains = useMemo(() => {
    const chainIds = new Set<number>();
    for (const a of agents) {
      if (a.chain_id) chainIds.add(a.chain_id);
    }
    return NETWORK_LIST.filter((n) => chainIds.has(n.chainId));
  }, [agents]);

  // --- Computed metrics ---
  const x402AgentCount = useMemo(
    () => agents.filter((a) => a.total_revenue_usdc > 0).length,
    [agents]
  );

  const onChainVerifiedCount = useMemo(
    () => agents.filter((a) => a.erc8004_token_id != null).length,
    [agents]
  );

  const protocolDist = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of agents) {
      for (const p of a.protocols || []) {
        const key = p.toUpperCase();
        counts[key] = (counts[key] || 0) + 1;
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([protocol, count]) => ({ protocol, count }));
  }, [agents]);

  const chainDist = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const a of agents) {
      if (a.chain_id) counts[a.chain_id] = (counts[a.chain_id] || 0) + 1;
    }
    return Object.entries(counts).map(([chainId, count]) => ({
      chainId: Number(chainId),
      name: getChainName(Number(chainId)) || `Chain ${chainId}`,
      count,
    }));
  }, [agents]);

  const topReputation = useMemo(
    () =>
      agents
        .filter((a) => a.reputation_score != null && a.reputation_score > 0)
        .sort((a, b) => (b.reputation_score ?? 0) - (a.reputation_score ?? 0))
        .slice(0, 5),
    [agents]
  );

  if (loading || !overview) {
    return <p className="text-gray-500">Loading...</p>;
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold">Platform Overview</h2>
        <p className="text-sm text-gray-500 mt-1">
          GT8004 network-wide metrics across all registered agents
        </p>
      </div>

      {/* Primary stats — 6 cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <StatCard
          label="Registered Agents"
          value={overview.total_agents}
          sub={`${overview.active_agents} active`}
        />
        <StatCard
          label="Total Requests"
          value={overview.total_requests.toLocaleString()}
          sub={`${overview.today_requests.toLocaleString()} today`}
        />
        <StatCard
          label="Total Revenue"
          value={`$${overview.total_revenue_usdc.toFixed(2)}`}
          sub="USDC"
        />
        <StatCard
          label="Avg Response"
          value={`${overview.avg_response_ms.toFixed(0)}ms`}
          sub="across all agents"
        />
        <StatCard
          label="X-402 Payments"
          value={`$${overview.total_revenue_usdc.toFixed(2)}`}
          sub={`${x402AgentCount} agents earning`}
        />
        <StatCard
          label="On-chain Verified"
          value={
            agents.length > 0
              ? `${Math.round((onChainVerifiedCount / agents.length) * 100)}%`
              : "0%"
          }
          sub={`${onChainVerifiedCount}/${agents.length} ERC-8004`}
        />
      </div>

      {/* Protocol Distribution + On-chain Identity — 2 column */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Protocol Distribution */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">
            Protocol Distribution
          </h3>
          {protocolDist.length > 0 ? (
            <div className="space-y-3">
              {protocolDist.map(({ protocol, count }) => {
                const pct =
                  agents.length > 0
                    ? Math.round((count / agents.length) * 100)
                    : 0;
                const barColor =
                  PROTOCOL_COLORS[protocol] || PROTOCOL_COLORS.HTTP;
                const textColor =
                  PROTOCOL_TEXT_COLORS[protocol] || PROTOCOL_TEXT_COLORS.HTTP;
                return (
                  <div key={protocol}>
                    <div className="flex justify-between items-center mb-1">
                      <span className={`text-sm font-medium ${textColor}`}>
                        {protocol}
                      </span>
                      <span className="text-xs text-gray-500">
                        {count} agents ({pct}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${barColor}`}
                        style={{ width: `${Math.max(pct, 4)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-600">No protocol data</p>
          )}
        </div>

        {/* On-chain Identity */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">
            On-chain Identity
          </h3>
          <div className="flex items-center gap-6 mb-5">
            {/* Verification circle */}
            <div className="relative w-20 h-20 shrink-0">
              <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
                <circle
                  cx="18"
                  cy="18"
                  r="15.5"
                  fill="none"
                  stroke="#1f2937"
                  strokeWidth="3"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="15.5"
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="3"
                  strokeDasharray={`${
                    agents.length > 0
                      ? (onChainVerifiedCount / agents.length) * 97.4
                      : 0
                  } 97.4`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold text-green-400">
                  {agents.length > 0
                    ? `${Math.round(
                        (onChainVerifiedCount / agents.length) * 100
                      )}%`
                    : "0%"}
                </span>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-1">
                <span className="text-green-400 font-semibold">
                  {onChainVerifiedCount}
                </span>{" "}
                of {agents.length} agents verified
              </p>
              <p className="text-xs text-gray-600">
                ERC-8004 Identity Registry
              </p>
            </div>
          </div>
          {/* Chain breakdown */}
          <div className="border-t border-gray-800 pt-3">
            <p className="text-xs text-gray-500 mb-2">Chain Distribution</p>
            <div className="flex flex-wrap gap-2">
              {chainDist.map(({ chainId, name, count }) => (
                <span
                  key={chainId}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-800 text-xs"
                >
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-gray-300">{name}</span>
                  <span className="text-gray-500 font-medium">{count}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Reputation Leaderboard */}
      {topReputation.length > 0 && (
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-5 mb-6">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">
            Reputation Leaderboard
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            {topReputation.map((agent, idx) => {
              const imgUrl = resolveImageUrl(
                parseAgentURIImage(agent.agent_uri)
              );
              return (
                <Link
                  key={agent.id}
                  href={
                    agent.chain_id && agent.erc8004_token_id != null
                      ? `/discovery/${agent.chain_id}/${agent.erc8004_token_id}`
                      : "#"
                  }
                  className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/50 hover:bg-gray-800 transition-colors"
                >
                  <span className="text-lg font-bold text-gray-600 w-5 shrink-0">
                    {idx + 1}
                  </span>
                  {imgUrl ? (
                    <img
                      src={imgUrl}
                      alt=""
                      className="w-9 h-9 rounded-md object-cover bg-gray-800 shrink-0"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-md bg-gray-700 flex items-center justify-center text-xs text-gray-500 shrink-0">
                      #
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white truncate">
                      {agent.name || `Token #${agent.erc8004_token_id}`}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-yellow-400 font-medium">
                        {agent.reputation_score?.toFixed(1)}
                      </span>
                      <span className="text-xs text-gray-600">
                        {agent.total_requests.toLocaleString()} req
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Agents table */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold">Agents on Network</h3>
          {availableChains.length > 0 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setChainFilter(null)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  chainFilter === null
                    ? "bg-gray-700 text-white"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                All
              </button>
              {availableChains.map((net) => {
                const isBase = net.chainId === 84532;
                const isActive = chainFilter === net.chainId;
                return (
                  <button
                    key={net.chainId}
                    onClick={() =>
                      setChainFilter(
                        chainFilter === net.chainId ? null : net.chainId
                      )
                    }
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                      isActive
                        ? isBase
                          ? "bg-blue-900/50 text-blue-400"
                          : "bg-purple-900/50 text-purple-400"
                        : "text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    {net.shortName}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <span className="text-sm text-gray-500">
          {filteredAgents.length} registered &middot; {activeCount} active
        </span>
      </div>
      <DataTable
        columns={agentColumns}
        data={filteredAgents}
        emptyMessage="No agents registered on the network yet"
      />
    </div>
  );
}
