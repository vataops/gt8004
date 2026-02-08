"use client";

import { useLogs } from "@/lib/hooks";
import { useAuth } from "@/lib/auth";
import { RequireAuth } from "@/components/RequireAuth";
import { DataTable, type Column } from "@/components/DataTable";
import { Badge } from "@/components/Badge";
import type { RequestLog } from "@/lib/api";

const columns: Column<RequestLog>[] = [
  {
    key: "method",
    header: "Method",
    render: (row) => (
      <span className="font-mono text-xs font-medium text-blue-400">{row.method}</span>
    ),
  },
  {
    key: "path",
    header: "Path",
    render: (row) => (
      <span className="font-mono text-xs text-gray-300">{row.path}</span>
    ),
  },
  {
    key: "status_code",
    header: "Status",
    render: (row) => (
      <Badge
        label={String(row.status_code)}
        variant={row.status_code < 400 ? "low" : row.status_code < 500 ? "medium" : "high"}
      />
    ),
  },
  {
    key: "response_ms",
    header: "Latency",
    render: (row) => `${row.response_ms.toFixed(0)}ms`,
  },
  {
    key: "customer_id",
    header: "Customer",
    render: (row) => row.customer_id || "-",
  },
  {
    key: "tool_name",
    header: "Tool",
    render: (row) => row.tool_name || "-",
  },
  {
    key: "x402_amount",
    header: "Payment",
    render: (row) => row.x402_amount ? `$${row.x402_amount.toFixed(4)}` : "-",
  },
  {
    key: "created_at",
    header: "Time",
    render: (row) => new Date(row.created_at).toLocaleString(),
  },
];

export default function LogsPage() {
  return (
    <RequireAuth>
      <LogsContent />
    </RequireAuth>
  );
}

function LogsContent() {
  const { agent, apiKey } = useAuth();
  const { data, loading } = useLogs(agent!.agent_id, apiKey!);

  if (loading) {
    return <p className="text-gray-500">Loading...</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Request Logs</h2>
        <span className="text-sm text-gray-500">
          {data?.total ?? 0} recent requests
        </span>
      </div>
      <DataTable
        columns={columns}
        data={data?.logs || []}
        emptyMessage="No request logs yet"
      />
    </div>
  );
}
