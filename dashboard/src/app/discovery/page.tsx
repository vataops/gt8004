"use client";

import { useState } from "react";
import { useDiscovery } from "@/lib/hooks";
import { StatCard } from "@/components/StatCard";
import { DataTable, type Column } from "@/components/DataTable";
import { Badge } from "@/components/Badge";
import type { Agent } from "@/lib/api";

const columns: Column<Agent>[] = [
  {
    key: "name",
    header: "Agent",
    render: (row) => (
      <div>
        <span className="font-medium text-white">
          {row.name || row.agent_id}
        </span>
        <p className="text-xs text-gray-500">{row.agent_id}</p>
      </div>
    ),
  },
  { key: "category", header: "Category" },
  {
    key: "protocols",
    header: "Protocols",
    render: (row) => (row.protocols || []).join(", ") || "-",
  },
  {
    key: "reputation_score" as keyof Agent as string,
    header: "Reputation",
    render: (row) => {
      const score =
        (row as unknown as Record<string, number>).reputation_score ?? 0;
      return score.toFixed(1);
    },
  },
  {
    key: "total_requests",
    header: "Requests",
    render: (row) => row.total_requests?.toLocaleString() ?? "0",
  },
  {
    key: "avg_response_ms",
    header: "Avg Latency",
    render: (row) =>
      row.avg_response_ms ? `${row.avg_response_ms.toFixed(0)}ms` : "-",
  },
  {
    key: "status",
    header: "Status",
    render: (row) => (
      <Badge
        label={row.status}
        variant={row.status === "active" ? "low" : "medium"}
      />
    ),
  },
];

const sortOptions = [
  { value: "reputation", label: "Reputation" },
  { value: "requests", label: "Most Requests" },
  { value: "revenue", label: "Most Revenue" },
  { value: "response_time", label: "Fastest" },
  { value: "newest", label: "Newest" },
];

export default function DiscoveryPage() {
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("reputation");
  const { data, loading } = useDiscovery({
    category: category || undefined,
    sort,
  });

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Agent Discovery</h2>

      <div className="flex gap-4 mb-6">
        <input
          type="text"
          placeholder="Filter by category..."
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {sortOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <StatCard label="Total Agents" value={data?.total ?? 0} />
          </div>
          <DataTable
            columns={columns}
            data={data?.agents || []}
            emptyMessage="No agents found"
          />
        </>
      )}
    </div>
  );
}
