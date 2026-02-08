"use client";

import { useOverview, useAgents } from "@/lib/hooks";
import { StatCard } from "@/components/StatCard";
import { DataTable, type Column } from "@/components/DataTable";
import type { Agent } from "@/lib/api";

const agentColumns: Column<Agent>[] = [
  {
    key: "name",
    header: "Name",
    render: (row) => (
      <span className="font-medium text-white">
        {row.name || row.agent_id}
      </span>
    ),
  },
  { key: "category", header: "Category" },
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

  if (loading || !overview) {
    return <p className="text-gray-500">Loading...</p>;
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Overview</h2>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <StatCard
          label="Today's Requests"
          value={overview.today_requests.toLocaleString()}
        />
        <StatCard
          label="Total Requests"
          value={overview.total_requests.toLocaleString()}
        />
        <StatCard
          label="Revenue (USDC)"
          value={`$${overview.total_revenue_usdc.toFixed(2)}`}
        />
        <StatCard label="Agents" value={overview.total_agents} />
        <StatCard label="Active Agents" value={overview.active_agents} />
        <StatCard
          label="Avg Response"
          value={`${overview.avg_response_ms.toFixed(0)}ms`}
        />
      </div>

      <h3 className="text-lg font-semibold mb-3">Registered Agents</h3>
      <DataTable
        columns={agentColumns}
        data={agentsData?.agents || []}
        emptyMessage="No agents registered yet"
      />
    </div>
  );
}
