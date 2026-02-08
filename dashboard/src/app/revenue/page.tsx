"use client";

import { useRevenue } from "@/lib/hooks";
import { StatCard } from "@/components/StatCard";
import { DataTable, type Column } from "@/components/DataTable";
import type { RevenuePeriod, RevenueByTool } from "@/lib/api";

const AGENT_ID = process.env.NEXT_PUBLIC_AGENT_ID || "default";

const periodColumns: Column<RevenuePeriod>[] = [
  {
    key: "period",
    header: "Period",
    render: (row) => (
      <span className="font-medium text-white">{row.period}</span>
    ),
  },
  {
    key: "amount",
    header: "Amount",
    render: (row) => (row.amount ? `$${row.amount.toFixed(2)}` : "-"),
  },
  {
    key: "count",
    header: "Transactions",
    render: (row) => row.count?.toLocaleString() ?? "0",
  },
];

const toolColumns: Column<RevenueByTool>[] = [
  {
    key: "tool_name",
    header: "Tool Name",
    render: (row) => (
      <span className="font-medium text-white">{row.tool_name}</span>
    ),
  },
  {
    key: "amount",
    header: "Amount",
    render: (row) => (row.amount ? `$${row.amount.toFixed(2)}` : "-"),
  },
  {
    key: "count",
    header: "Transactions",
    render: (row) => row.count?.toLocaleString() ?? "0",
  },
];

export default function RevenuePage() {
  const { data, loading } = useRevenue(AGENT_ID);

  if (loading || !data) {
    return <p className="text-gray-500">Loading...</p>;
  }

  const periods = data.periods || [];
  const latestAmount =
    periods.length > 0 ? `$${periods[periods.length - 1].amount.toFixed(2)}` : "-";

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Revenue</h2>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <StatCard
          label="Total Revenue"
          value={`$${data.total_revenue.toFixed(2)}`}
        />
        <StatCard label="ARPU" value={`$${data.arpu.toFixed(2)}`} />
        <StatCard label="Latest Period" value={latestAmount} />
      </div>

      <h3 className="text-lg font-semibold mb-3">Revenue by Period</h3>
      <DataTable
        columns={periodColumns}
        data={periods}
        emptyMessage="No revenue data"
      />

      <h3 className="text-lg font-semibold mb-3 mt-8">Revenue by Tool</h3>
      <DataTable
        columns={toolColumns}
        data={data.by_tool || []}
        emptyMessage="No tool revenue data"
      />
    </div>
  );
}
