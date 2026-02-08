"use client";

import { useAlerts, useAlertHistory } from "@/lib/hooks";
import { DataTable, type Column } from "@/components/DataTable";
import { Badge } from "@/components/Badge";
import type { AlertRule, AlertHistoryEntry } from "@/lib/api";

const AGENT_ID = process.env.NEXT_PUBLIC_AGENT_ID || "default";

const ruleColumns: Column<AlertRule>[] = [
  {
    key: "name",
    header: "Name",
    render: (row) => <span className="font-medium text-white">{row.name}</span>,
  },
  { key: "type", header: "Type" },
  { key: "metric", header: "Metric" },
  {
    key: "threshold",
    header: "Condition",
    render: (row) => `${row.operator} ${row.threshold}`,
  },
  {
    key: "window_minutes",
    header: "Window",
    render: (row) => `${row.window_minutes}m`,
  },
  {
    key: "enabled",
    header: "Status",
    render: (row) => (
      <Badge
        label={row.enabled ? "Active" : "Disabled"}
        variant={row.enabled ? "low" : "medium"}
      />
    ),
  },
];

const historyColumns: Column<AlertHistoryEntry>[] = [
  {
    key: "message",
    header: "Message",
    render: (row) => <span className="text-white">{row.message}</span>,
  },
  {
    key: "metric_value",
    header: "Value",
    render: (row) => row.metric_value.toFixed(2),
  },
  {
    key: "threshold",
    header: "Threshold",
    render: (row) => row.threshold.toFixed(2),
  },
  {
    key: "notified",
    header: "Notified",
    render: (row) => (
      <Badge
        label={row.notified ? "Yes" : "No"}
        variant={row.notified ? "low" : "high"}
      />
    ),
  },
  {
    key: "created_at",
    header: "Time",
    render: (row) => new Date(row.created_at).toLocaleString(),
  },
];

export default function AlertsPage() {
  const { data: alertsData, loading } = useAlerts(AGENT_ID);
  const { data: historyData } = useAlertHistory(AGENT_ID);

  if (loading) {
    return <p className="text-gray-500">Loading...</p>;
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Alerts</h2>

      <h3 className="text-lg font-semibold mb-3">Alert Rules</h3>
      <DataTable
        columns={ruleColumns}
        data={alertsData?.rules || []}
        emptyMessage="No alert rules configured"
      />

      <h3 className="text-lg font-semibold mb-3 mt-8">Recent Alert History</h3>
      <DataTable
        columns={historyColumns}
        data={historyData?.history || []}
        emptyMessage="No alerts triggered yet"
      />
    </div>
  );
}
