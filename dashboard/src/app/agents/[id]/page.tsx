"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { StatCard } from "@/components/StatCard";
import { Badge } from "@/components/Badge";
import { CodeBlock } from "@/components/CodeBlock";
import { CopyButton } from "@/components/CopyButton";
import { openApi } from "@/lib/api";
import { hasWallet, connectWallet, signChallenge } from "@/lib/wallet";
import {
  useAgentStats,
  useDailyStats,
  useCustomers,
  useRevenue,
  usePerformance,
  useLogs,
} from "@/lib/hooks";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_OPEN_API_URL || "http://localhost:8080";

export default function AgentDashboardPage() {
  const { id } = useParams<{ id: string }>();
  const { apiKey, agent, walletAddress, loading: authLoading, login } = useAuth();
  const router = useRouter();

  // Settings state
  const [gatewayLoading, setGatewayLoading] = useState(false);
  const [editingEndpoint, setEditingEndpoint] = useState(false);
  const [endpointValue, setEndpointValue] = useState("");
  const [endpointSaving, setEndpointSaving] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState("");
  const [verifyError, setVerifyError] = useState("");

  // Redirect if not authenticated
  if (!authLoading && !apiKey && !walletAddress) {
    router.replace("/login");
    return null;
  }

  const key = apiKey || "";

  // Fetch all data in parallel
  const { data: stats } = useAgentStats(id, key);
  const { data: daily } = useDailyStats(id, key, 30);
  const { data: customers } = useCustomers(id, key);
  const { data: revenue } = useRevenue(id, key, "monthly");
  const { data: performance } = usePerformance(id, key, "24h");
  const { data: logs } = useLogs(id, key, 10);

  if (authLoading) {
    return <p className="text-gray-500">Loading...</p>;
  }

  if (!apiKey) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
        <p className="text-gray-400 text-sm">
          API key required to view agent dashboard.
        </p>
        <p className="text-gray-500 text-xs">
          Log in with your agent&apos;s API key or register this agent first.
        </p>
        <Link
          href="/my-agents"
          className="text-blue-400 hover:text-blue-300 text-sm"
        >
          Back to My Agents
        </Link>
      </div>
    );
  }

  const dailyStats = daily?.stats || [];
  const recentLogs = logs?.logs || [];
  const customerTotal = customers?.total ?? 0;
  const byTool = revenue?.by_tool || [];

  const chartData = dailyStats.map((d) => ({
    ...d,
    label: d.date.slice(5).replace("-", "/"),
  }));

  const gatewayUrl = `${BACKEND_URL}/gateway/${agent?.agent_id || id}/`;

  const handleGatewayToggle = async () => {
    if (!agent || !apiKey) return;
    setGatewayLoading(true);
    try {
      if (agent.gateway_enabled) {
        await openApi.disableGateway(agent.agent_id, apiKey);
      } else {
        await openApi.enableGateway(agent.agent_id, apiKey);
      }
      await login(apiKey);
    } catch (err) {
      console.error("Gateway toggle failed:", err);
    } finally {
      setGatewayLoading(false);
    }
  };

  const handleEndpointSave = async () => {
    if (!apiKey) return;
    setEndpointSaving(true);
    try {
      await openApi.updateOriginEndpoint(apiKey, endpointValue);
      await login(apiKey);
      setEditingEndpoint(false);
    } catch (err) {
      console.error("Failed to update endpoint:", err);
    } finally {
      setEndpointSaving(false);
    }
  };

  const handleVerify = async () => {
    if (!agent || !apiKey) return;
    setVerifyError("");
    setVerifyStatus("Connecting wallet...");
    try {
      await connectWallet();
      setVerifyStatus("Requesting challenge...");
      const { challenge } = await openApi.getChallenge(agent.agent_id);
      setVerifyStatus("Sign the message in your wallet...");
      const signature = await signChallenge(challenge);
      setVerifyStatus("Verifying...");
      await openApi.verifySignature(agent.agent_id, challenge, signature);
      await login(apiKey);
      setVerifyStatus("");
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : "Verification failed");
      setVerifyStatus("");
    }
  };

  const ingestExample = `curl -X POST ${BACKEND_URL}/v1/ingest \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "agent_id": "${agent?.agent_id || id}",
    "sdk_version": "manual",
    "batch_id": "unique-batch-id",
    "entries": [{
      "requestId": "unique-request-id",
      "method": "POST",
      "path": "/api/chat",
      "statusCode": 200,
      "responseMs": 142,
      "timestamp": "${new Date().toISOString()}"
    }]
  }'`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Link
              href="/my-agents"
              className="text-gray-500 hover:text-gray-300 transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </Link>
            <h2 className="text-xl font-bold">
              {agent?.name || id}
              {agent?.erc8004_token_id != null && (
                <span className="text-gray-500 ml-1.5 text-base font-normal">
                  #{agent.erc8004_token_id}
                </span>
              )}
            </h2>
          </div>
          <p className="text-xs text-gray-500 mt-1 font-mono ml-8">{id}</p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Total Requests"
          value={stats?.total_requests?.toLocaleString() ?? "—"}
          sub={`This week: ${stats?.week_requests?.toLocaleString() ?? "—"}`}
        />
        <StatCard
          label="Today Requests"
          value={stats?.today_requests?.toLocaleString() ?? "—"}
        />
        <StatCard
          label="Revenue (USDC)"
          value={
            stats?.total_revenue_usdc != null
              ? `$${stats.total_revenue_usdc.toFixed(2)}`
              : "—"
          }
          sub={
            revenue?.arpu != null
              ? `ARPU: $${revenue.arpu.toFixed(2)}`
              : undefined
          }
        />
        <StatCard
          label="Customers"
          value={customerTotal}
        />
      </div>

      {/* Charts */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-1 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-400 mb-3">
              Requests (30 days)
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#6B7280" }} axisLine={{ stroke: "#374151" }} />
                <YAxis tick={{ fontSize: 10, fill: "#6B7280" }} axisLine={{ stroke: "#374151" }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1F2937", border: "1px solid #374151", borderRadius: "6px", fontSize: 12 }}
                  labelStyle={{ color: "#9CA3AF" }}
                />
                <Bar dataKey="requests" fill="#3B82F6" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-400 mb-3">
              Revenue (30 days)
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#6B7280" }} axisLine={{ stroke: "#374151" }} />
                <YAxis tick={{ fontSize: 10, fill: "#6B7280" }} axisLine={{ stroke: "#374151" }} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1F2937", border: "1px solid #374151", borderRadius: "6px", fontSize: 12 }}
                  labelStyle={{ color: "#9CA3AF" }}
                  formatter={(value: number | undefined) => [`$${(value ?? 0).toFixed(2)}`, "Revenue"]}
                />
                <Bar dataKey="revenue" fill="#10B981" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Performance + Revenue by Tool */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Performance</h3>
          {performance ? (
            <div className="space-y-2 text-sm">
              <MetricRow label="P50 Latency" value={`${performance.p50_response_ms.toFixed(0)}ms`} />
              <MetricRow label="P95 Latency" value={`${performance.p95_response_ms.toFixed(0)}ms`} />
              <MetricRow label="P99 Latency" value={`${performance.p99_response_ms.toFixed(0)}ms`} />
              <MetricRow label="Error Rate" value={`${(performance.error_rate * 100).toFixed(1)}%`} color={performance.error_rate > 0.05 ? "text-red-400" : "text-green-400"} />
              <MetricRow label="Uptime" value={`${(performance.uptime * 100).toFixed(1)}%`} color={performance.uptime >= 0.99 ? "text-green-400" : "text-yellow-400"} />
              <MetricRow label="RPM" value={performance.requests_per_min.toFixed(1)} />
            </div>
          ) : (
            <p className="text-xs text-gray-600">No data yet</p>
          )}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Revenue by Tool</h3>
          {byTool.length > 0 ? (
            <div className="space-y-2">
              {byTool.map((t) => (
                <div key={t.tool_name} className="flex items-center justify-between text-sm">
                  <span className="text-gray-300 truncate mr-2">{t.tool_name}</span>
                  <span className="text-gray-400 font-mono text-xs">
                    ${t.amount.toFixed(2)} <span className="text-gray-600">({t.count})</span>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-600">No tool revenue data</p>
          )}
        </div>
      </div>

      {/* Recent Requests */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-gray-800">
          <h3 className="text-sm font-medium text-gray-400">Recent Requests</h3>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-800 text-gray-500">
              <th className="text-left p-3">Method</th>
              <th className="text-left p-3">Path</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Latency</th>
              <th className="text-left p-3">Amount</th>
              <th className="text-left p-3">Time</th>
            </tr>
          </thead>
          <tbody>
            {recentLogs.map((log) => (
              <tr key={log.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="p-3"><span className="font-mono text-blue-400">{log.method}</span></td>
                <td className="p-3 text-gray-300 truncate max-w-[200px]">{log.path}</td>
                <td className="p-3"><StatusCode code={log.status_code} /></td>
                <td className="p-3 text-gray-400 font-mono">{log.response_ms.toFixed(0)}ms</td>
                <td className="p-3 text-gray-400 font-mono">{log.x402_amount ? `$${log.x402_amount.toFixed(2)}` : "—"}</td>
                <td className="p-3 text-gray-500">{timeAgo(log.created_at)}</td>
              </tr>
            ))}
            {recentLogs.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-gray-600">
                  No request logs yet. Integrate the SDK to start collecting data.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ===== Settings ===== */}
      <div className="border-t border-gray-800 pt-6">
        <h3 className="text-lg font-bold mb-4">Settings</h3>

        {/* Agent Info */}
        <section className="mb-6">
          <h4 className="text-sm font-semibold text-gray-400 mb-3">Agent Info</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <StatCard label="Agent ID" value={agent?.agent_id || id} />
            <StatCard label="Status" value={agent?.status || "-"} />
            <StatCard label="Category" value={agent?.category || "-"} />
            <StatCard label="Protocols" value={agent?.protocols?.join(", ") || "-"} />
            <StatCard label="Tier" value={agent?.current_tier || "open"} />
            <StatCard label="Created" value={agent ? new Date(agent.created_at).toLocaleDateString() : "-"} />
          </div>
        </section>

        {/* Origin Endpoint */}
        <section className="mb-6">
          <h4 className="text-sm font-semibold text-gray-400 mb-3">Origin Endpoint</h4>
          <div className="p-4 rounded-lg border border-gray-800 bg-gray-900">
            <p className="text-xs text-gray-500 mb-2">
              The endpoint where gateway traffic is routed to.
            </p>
            {editingEndpoint ? (
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  value={endpointValue}
                  onChange={(e) => setEndpointValue(e.target.value)}
                  placeholder="https://api.example.com"
                  className="flex-1 px-3 py-2 bg-gray-950 border border-gray-700 rounded-md text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={handleEndpointSave}
                  disabled={endpointSaving || !endpointValue}
                  className="px-3 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium disabled:opacity-50 transition-colors"
                >
                  {endpointSaving ? "..." : "Save"}
                </button>
                <button
                  onClick={() => setEditingEndpoint(false)}
                  className="px-3 py-2 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm font-mono text-gray-300 bg-gray-950 px-3 py-2 rounded border border-gray-800 break-all">
                  {agent?.origin_endpoint || "-"}
                </code>
                <button
                  onClick={() => {
                    setEndpointValue(agent?.origin_endpoint || "");
                    setEditingEndpoint(true);
                  }}
                  className="px-3 py-2 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm transition-colors"
                >
                  Edit
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Integration */}
        <section className="mb-6">
          <h4 className="text-sm font-semibold text-gray-400 mb-3">Integration</h4>
          <div className="p-4 rounded-lg border border-gray-800 bg-gray-900 space-y-4 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white">Gateway Mode</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Enable the gateway to automatically capture all requests.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge
                  label={agent?.gateway_enabled ? "Enabled" : "Disabled"}
                  variant={agent?.gateway_enabled ? "low" : "medium"}
                />
                <button
                  onClick={handleGatewayToggle}
                  disabled={gatewayLoading}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors disabled:opacity-50 ${
                    agent?.gateway_enabled
                      ? "bg-red-900/30 text-red-400 hover:bg-red-900/50"
                      : "bg-green-900/30 text-green-400 hover:bg-green-900/50"
                  }`}
                >
                  {gatewayLoading ? "..." : agent?.gateway_enabled ? "Disable" : "Enable"}
                </button>
              </div>
            </div>
            {agent?.gateway_enabled && (
              <div>
                <p className="text-xs text-gray-500 mb-1">
                  Share this URL with your customers. All traffic is proxied to your origin.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm font-mono text-blue-400 bg-gray-950 px-3 py-2 rounded border border-gray-800 break-all">
                    {gatewayUrl}
                  </code>
                  <CopyButton text={gatewayUrl} />
                </div>
              </div>
            )}
          </div>

          <div className="p-4 rounded-lg border border-gray-800 bg-gray-900/50 space-y-3">
            <div>
              <p className="text-sm font-medium text-gray-300">SDK Mode</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Send request logs directly via the Ingest API.
              </p>
            </div>
            <CodeBlock code={ingestExample} label="Ingest API" />
          </div>
        </section>

        {/* API Key */}
        <section className="mb-6">
          <h4 className="text-sm font-semibold text-gray-400 mb-3">API Key</h4>
          <div className="p-4 rounded-lg border border-gray-800 bg-gray-900">
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm font-mono text-gray-300 bg-gray-950 px-3 py-2 rounded border border-gray-800 break-all">
                {apiKey}
              </code>
              <CopyButton text={apiKey} />
            </div>
            <p className="text-xs text-gray-600 mt-2">
              Use this key to authenticate SDK and API requests.
            </p>
          </div>
        </section>

        {/* ERC-8004 Identity */}
        <section>
          <h4 className="text-sm font-semibold text-gray-400 mb-3">ERC-8004 Identity</h4>
          <div className="p-4 rounded-lg border border-gray-800 bg-gray-900">
            {agent?.evm_address ? (
              <div className="flex items-center gap-3">
                <code className="text-sm font-mono text-gray-300">{agent.evm_address}</code>
                <Badge label="Verified" variant="low" />
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-400">
                  No wallet linked. Verify your identity with an Ethereum wallet.
                </p>
                {verifyStatus ? (
                  <p className="text-sm text-gray-300">{verifyStatus}</p>
                ) : (
                  <button
                    onClick={handleVerify}
                    disabled={!hasWallet()}
                    className="px-4 py-2 rounded-md bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Verify with Wallet
                  </button>
                )}
                {verifyError && <p className="text-sm text-red-400">{verifyError}</p>}
                {!hasWallet() && (
                  <p className="text-xs text-gray-600">MetaMask or a compatible wallet is required.</p>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function MetricRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500">{label}</span>
      <span className={`font-mono ${color || "text-gray-300"}`}>{value}</span>
    </div>
  );
}

function StatusCode({ code }: { code: number }) {
  const color = code < 300 ? "text-green-400" : code < 400 ? "text-blue-400" : code < 500 ? "text-yellow-400" : "text-red-400";
  return <span className={`font-mono ${color}`}>{code}</span>;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
