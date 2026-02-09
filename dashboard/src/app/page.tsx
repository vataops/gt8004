"use client";

import { useState, useMemo } from "react";
import { useOverview, useAgents } from "@/lib/hooks";
import { StatCard } from "@/components/StatCard";
import { DataTable, type Column } from "@/components/DataTable";
import type { Agent } from "@/lib/api";
import { NETWORK_LIST } from "@/lib/networks";

function getChainName(chainId: number): string {
  const net = NETWORK_LIST.find((n) => n.chainId === chainId);
  return net?.shortName ?? "";
}

const agentColumns: Column<Agent>[] = [
  {
    key: "name",
    header: "Agent",
    render: (row) => (
      <div>
        <span className="font-medium text-white">
          {row.name || row.agent_id}
        </span>
        {row.name && (
          <p className="text-xs text-gray-500 font-mono mt-0.5">
            {row.agent_id.length > 20
              ? `${row.agent_id.slice(0, 10)}...${row.agent_id.slice(-6)}`
              : row.agent_id}
          </p>
        )}
      </div>
    ),
  },
  { key: "category", header: "Category" },
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
    key: "total_revenue_usdc",
    header: "Revenue",
    render: (row) =>
      row.total_revenue_usdc ? `$${row.total_revenue_usdc.toFixed(2)}` : "-",
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

      {/* Primary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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
      </div>

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
