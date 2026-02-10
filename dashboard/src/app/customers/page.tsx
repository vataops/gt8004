"use client";

import { useCustomers } from "@/lib/hooks";
import { useAuth } from "@/lib/auth";
import { RequireAuth } from "@/components/RequireAuth";
import { StatCard } from "@/components/StatCard";
import { DataTable, type Column } from "@/components/DataTable";
import { Badge } from "@/components/Badge";
import type { Customer } from "@/lib/api";

const customerColumns: Column<Customer>[] = [
  {
    key: "customer_id",
    header: "IP Address",
    render: (row) => (
      <span className="font-mono font-medium text-white">{row.customer_id}</span>
    ),
  },
  {
    key: "country",
    header: "Location",
    render: (row) =>
      row.country
        ? row.city ? `${row.city}, ${row.country}` : row.country
        : "-",
  },
  {
    key: "last_seen_at",
    header: "Last Seen",
    render: (row) =>
      row.last_seen_at
        ? new Date(row.last_seen_at).toLocaleDateString()
        : "-",
  },
  {
    key: "total_requests",
    header: "Requests",
    render: (row) => row.total_requests?.toLocaleString() ?? "0",
  },
  {
    key: "total_revenue",
    header: "Revenue",
    render: (row) =>
      row.total_revenue ? `$${row.total_revenue.toFixed(2)}` : "-",
  },
  {
    key: "avg_response_ms",
    header: "Avg Latency",
    render: (row) =>
      row.avg_response_ms ? `${row.avg_response_ms.toFixed(0)}ms` : "-",
  },
  {
    key: "churn_risk",
    header: "Churn Risk",
    render: (row) => (
      <Badge label={row.churn_risk || "low"} variant={row.churn_risk} />
    ),
  },
];

export default function CustomersPage() {
  return (
    <RequireAuth>
      <CustomersContent />
    </RequireAuth>
  );
}

function CustomersContent() {
  const { agent, apiKey } = useAuth();
  const { data, loading } = useCustomers(agent!.agent_id);

  if (loading || !data) {
    return <p className="text-gray-500">Loading...</p>;
  }

  const customers = data.customers || [];
  const totalCustomers = data.total || customers.length;
  const active = customers.filter((c) => c.churn_risk === "low").length;
  const atRisk = customers.filter((c) => c.churn_risk === "medium").length;
  const churning = customers.filter((c) => c.churn_risk === "high").length;

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Customers</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Customers" value={totalCustomers} />
        <StatCard label="Active (Low Risk)" value={active} />
        <StatCard label="At Risk (Medium)" value={atRisk} />
        <StatCard label="Churning (High)" value={churning} />
      </div>

      <h3 className="text-lg font-semibold mb-3">Customer List</h3>
      <DataTable
        columns={customerColumns}
        data={customers}
        emptyMessage="No customers found"
      />
    </div>
  );
}
