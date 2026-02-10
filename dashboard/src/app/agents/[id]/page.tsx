"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { StatCard } from "@/components/StatCard";
import { Badge } from "@/components/Badge";
import { CodeBlock } from "@/components/CodeBlock";
import { CopyButton } from "@/components/CopyButton";
import { openApi, type Agent, type NetworkAgent } from "@/lib/api";
import { hasWallet, connectWallet, signChallenge } from "@/lib/wallet";
import { NETWORKS, resolveImageUrl } from "@/lib/networks";
import {
  useAgentStats,
  useDailyStats,
  useCustomers,
  useRevenue,
  usePerformance,
  useLogs,
  useAnalytics,
  useTrustScore,
  useFunnel,
  useCustomerLogs,
  useCustomerTools,
  useCustomerDaily,
} from "@/lib/hooks";
import type { AnalyticsReport, Customer, CustomerToolUsage, RequestLog, DailyStats, TrustScoreResponse, AgentReview, FunnelReport } from "@/lib/api";
import {
  AreaChart,
  Area,
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

type Tab = "overview" | "analytics" | "speed" | "observability" | "revenue" | "customers" | "trust" | "settings";

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "analytics", label: "Analytics" },
  { key: "customers", label: "Customers" },
  { key: "revenue", label: "Revenue" },
  { key: "observability", label: "Observability" },
  { key: "speed", label: "Speed Insights" },
  { key: "trust", label: "Trust" },
  { key: "settings", label: "Settings" },
];

export default function AgentDashboardPage() {
  const { id } = useParams<{ id: string }>();
  const { apiKey, agent: authAgent, walletAddress, loading: authLoading, login } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  // Resolve the viewed agent: if URL id matches auth agent, use it directly.
  // Otherwise fetch wallet agents to find the correct one.
  const [viewedAgent, setViewedAgent] = useState<Agent | null>(null);

  useEffect(() => {
    if (!id) return;
    if (authAgent?.agent_id === id) {
      setViewedAgent(authAgent);
      return;
    }
    // Different agent — look up via wallet agents
    if (walletAddress) {
      openApi.getWalletAgents(walletAddress).then(({ agents }) => {
        const found = agents.find((a) => a.agent_id === id);
        if (found) setViewedAgent(found);
        else setViewedAgent(null);
      }).catch(() => setViewedAgent(null));
    }
  }, [id, authAgent, walletAddress]);

  const agent = viewedAgent;

  // Fetch on-chain network agent data (metadata, contract info)
  const [networkAgent, setNetworkAgent] = useState<NetworkAgent | null>(null);

  useEffect(() => {
    if (!viewedAgent?.erc8004_token_id || !walletAddress) {
      setNetworkAgent(null);
      return;
    }
    const tokenId = viewedAgent.erc8004_token_id;
    // Try all known chains to find the matching network agent
    const chainIds = Object.values(NETWORKS).map((n) => n.chainId);
    Promise.allSettled(
      chainIds.map((cid) => openApi.getNetworkAgent(cid, tokenId))
    ).then((results) => {
      for (const r of results) {
        if (r.status === "fulfilled" && r.value) {
          setNetworkAgent(r.value);
          return;
        }
      }
      setNetworkAgent(null);
    });
  }, [viewedAgent?.erc8004_token_id, walletAddress]);

  const refreshAgent = async () => {
    if (authAgent?.agent_id === id) {
      await login(apiKey!);
    } else if (walletAddress) {
      const { agents } = await openApi.getWalletAgents(walletAddress);
      const found = agents.find((a) => a.agent_id === id);
      if (found) setViewedAgent(found);
    }
  };

  // Settings state
  const [gatewayLoading, setGatewayLoading] = useState(false);
  const [editingEndpoint, setEditingEndpoint] = useState(false);
  const [endpointValue, setEndpointValue] = useState("");
  const [endpointSaving, setEndpointSaving] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [gatewayError, setGatewayError] = useState("");

  // Fetch all data in parallel (public endpoints, no auth needed)
  const { data: stats } = useAgentStats(id);
  const { data: daily } = useDailyStats(id, 30);
  const { data: customers } = useCustomers(id);
  const { data: revenue } = useRevenue(id, "monthly");
  const { data: performance } = usePerformance(id, "24h");
  const { data: logs } = useLogs(id, 50);
  const { data: analytics } = useAnalytics(id, 30);
  const { data: trustData } = useTrustScore(id);
  const { data: funnel } = useFunnel(id, 30);

  if (authLoading) {
    return <p className="text-gray-500">Loading...</p>;
  }

  const dailyStats = daily?.stats || [];
  const recentLogs = logs?.logs || [];
  const customerTotal = customers?.total ?? 0;
  const byTool = revenue?.by_tool || [];

  const chartData = dailyStats.map((d) => ({
    ...d,
    label: d.date.slice(5).replace("-", "/"),
  }));

  // Compute period comparisons for analytics
  const thisWeekRequests = dailyStats.slice(-7).reduce((s, d) => s + d.requests, 0);
  const prevWeekRequests = dailyStats.slice(-14, -7).reduce((s, d) => s + d.requests, 0);
  const requestsDelta = prevWeekRequests > 0
    ? ((thisWeekRequests - prevWeekRequests) / prevWeekRequests) * 100
    : 0;

  const thisWeekCustomers = dailyStats.slice(-7).reduce((s, d) => s + d.unique_customers, 0);
  const prevWeekCustomers = dailyStats.slice(-14, -7).reduce((s, d) => s + d.unique_customers, 0);
  const customersDelta = prevWeekCustomers > 0
    ? ((thisWeekCustomers - prevWeekCustomers) / prevWeekCustomers) * 100
    : 0;

  const gatewayUrl = `${BACKEND_URL}/gateway/${agent?.agent_id || id}/`;

  const handleGatewayToggle = async () => {
    if (!agent) return;
    if (!apiKey) {
      setGatewayError("API key required. Log in with your agent's API key to change gateway settings.");
      return;
    }
    setGatewayError("");
    setGatewayLoading(true);
    try {
      if (agent.gateway_enabled) {
        await openApi.disableGateway(agent.agent_id, apiKey);
      } else {
        await openApi.enableGateway(agent.agent_id, apiKey);
      }
      await refreshAgent();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gateway toggle failed";
      setGatewayError(msg);
    } finally {
      setGatewayLoading(false);
    }
  };

  const handleEndpointSave = async () => {
    if (!apiKey) return;
    setEndpointSaving(true);
    try {
      await openApi.updateOriginEndpoint(apiKey, endpointValue);
      await refreshAgent();
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
      await refreshAgent();
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
    <div className="space-y-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
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
              {networkAgent?.name || agent?.name || id}
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

      {/* Tab Navigation */}
      <div className="border-b border-gray-800 mb-6">
        <nav className="flex gap-0 -mb-px">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
                activeTab === tab.key
                  ? "text-white"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {tab.label}
              {activeTab === tab.key && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-full" />
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {activeTab === "overview" && (
          <OverviewTab agent={agent} networkAgent={networkAgent} id={id} />
        )}
        {activeTab === "analytics" && (
          <AnalyticsTab
            stats={stats}
            chartData={chartData}
            thisWeekRequests={thisWeekRequests}
            requestsDelta={requestsDelta}
            thisWeekCustomers={thisWeekCustomers}
            customersDelta={customersDelta}
            totalCustomers={customerTotal}
            analytics={analytics}
            funnel={funnel}
          />
        )}
        {activeTab === "speed" && (
          <SpeedInsightsTab performance={performance} />
        )}
        {activeTab === "observability" && (
          <ObservabilityTab
            recentLogs={recentLogs}
            chartData={chartData}
            stats={stats}
          />
        )}
        {activeTab === "revenue" && (
          <RevenueTab
            stats={stats}
            revenue={revenue}
            byTool={byTool}
            chartData={chartData}
          />
        )}
        {activeTab === "customers" && (
          <CustomersTab
            agentId={id}
            customers={customers?.customers || []}
            totalCustomers={customerTotal}
          />
        )}
        {activeTab === "trust" && (
          <TrustTab agentId={id} trustData={trustData} />
        )}
        {activeTab === "settings" && (
          <SettingsTab
            agent={agent}
            id={id}
            apiKey={apiKey}
            gatewayUrl={gatewayUrl}
            gatewayLoading={gatewayLoading}
            gatewayError={gatewayError}
            onGatewayToggle={handleGatewayToggle}
            editingEndpoint={editingEndpoint}
            endpointValue={endpointValue}
            endpointSaving={endpointSaving}
            onEndpointChange={setEndpointValue}
            onEndpointEdit={() => {
              setEndpointValue(agent?.origin_endpoint || "");
              setEditingEndpoint(true);
            }}
            onEndpointSave={handleEndpointSave}
            onEndpointCancel={() => setEditingEndpoint(false)}
            ingestExample={ingestExample}
            verifyStatus={verifyStatus}
            verifyError={verifyError}
            onVerify={handleVerify}
          />
        )}
      </div>
    </div>
  );
}

/* ---------- Settings ---------- */

interface SettingsTabProps {
  agent: Agent | null;
  id: string;
  apiKey: string | null;
  gatewayUrl: string;
  gatewayLoading: boolean;
  gatewayError: string;
  onGatewayToggle: () => void;
  editingEndpoint: boolean;
  endpointValue: string;
  endpointSaving: boolean;
  onEndpointChange: (v: string) => void;
  onEndpointEdit: () => void;
  onEndpointSave: () => void;
  onEndpointCancel: () => void;
  ingestExample: string;
  verifyStatus: string;
  verifyError: string;
  onVerify: () => void;
}

function SettingsTab({
  agent,
  id,
  apiKey,
  gatewayUrl,
  gatewayLoading,
  gatewayError,
  onGatewayToggle,
  editingEndpoint,
  endpointValue,
  endpointSaving,
  onEndpointChange,
  onEndpointEdit,
  onEndpointSave,
  onEndpointCancel,
  ingestExample,
  verifyStatus,
  verifyError,
  onVerify,
}: SettingsTabProps) {
  return (
    <div className="space-y-6">
      {/* Agent Info */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
        <h4 className="text-sm font-semibold text-gray-400 mb-4">Agent Info</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard label="Agent ID" value={agent?.agent_id || id} />
          <StatCard label="Status" value={agent?.status || "-"} />
          <StatCard label="Category" value={agent?.category || "-"} />
          <StatCard label="Protocols" value={agent?.protocols?.join(", ") || "-"} />
          <StatCard label="Created" value={agent ? new Date(agent.created_at).toLocaleDateString() : "-"} />
        </div>
      </div>

      {/* Origin Endpoint */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
        <h4 className="text-sm font-semibold text-gray-400 mb-4">Origin Endpoint</h4>
        <p className="text-xs text-gray-500 mb-3">
          The endpoint where gateway traffic is routed to.
        </p>
        {editingEndpoint ? (
          <div className="flex items-center gap-2">
            <input
              type="url"
              value={endpointValue}
              onChange={(e) => onEndpointChange(e.target.value)}
              placeholder="https://api.example.com"
              className="flex-1 px-3 py-2 bg-gray-950 border border-gray-700 rounded-md text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={onEndpointSave}
              disabled={endpointSaving || !endpointValue}
              className="px-3 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {endpointSaving ? "..." : "Save"}
            </button>
            <button
              onClick={onEndpointCancel}
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
              onClick={onEndpointEdit}
              className="px-3 py-2 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm transition-colors"
            >
              Edit
            </button>
          </div>
        )}
      </div>

      {/* Integration */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-5 space-y-4">
        <h4 className="text-sm font-semibold text-gray-400 mb-2">Integration</h4>
        <div className="p-4 rounded-lg border border-gray-800 bg-gray-950 space-y-4">
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
                onClick={onGatewayToggle}
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
          {gatewayError && (
            <p className="text-sm text-red-400">{gatewayError}</p>
          )}
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

        <div className="p-4 rounded-lg border border-gray-800 bg-gray-950 space-y-3">
          <div>
            <p className="text-sm font-medium text-gray-300">SDK Mode</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Send request logs directly via the Ingest API.
            </p>
          </div>
          <CodeBlock code={ingestExample} label="Ingest API" />
        </div>
      </div>

      {/* API Key */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
        <h4 className="text-sm font-semibold text-gray-400 mb-4">API Key</h4>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-sm font-mono text-gray-300 bg-gray-950 px-3 py-2 rounded border border-gray-800 break-all">
            {apiKey}
          </code>
          <CopyButton text={apiKey || ""} />
        </div>
        <p className="text-xs text-gray-600 mt-2">
          Use this key to authenticate SDK and API requests.
        </p>
      </div>

      {/* ERC-8004 Identity */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
        <h4 className="text-sm font-semibold text-gray-400 mb-4">ERC-8004 Identity</h4>
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
                onClick={onVerify}
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
    </div>
  );
}

/* ---------- Overview ---------- */

const chainName = (chainId: number): string => {
  for (const n of Object.values(NETWORKS)) {
    if (n.chainId === chainId) return n.shortName;
  }
  return `Chain ${chainId}`;
};

const explorerUrl = (chainId: number): string | null => {
  for (const n of Object.values(NETWORKS)) {
    if (n.chainId === chainId) return n.blockExplorer;
  }
  return null;
};

interface OverviewTabProps {
  agent: Agent | null;
  networkAgent: NetworkAgent | null;
  id: string;
}

function OverviewTab({ agent, networkAgent, id }: OverviewTabProps) {
  const meta = networkAgent?.metadata;
  const imageUrl = resolveImageUrl(meta?.image ?? networkAgent?.image_url ?? null);
  const description = meta?.description ?? networkAgent?.description;
  const services = meta?.services ?? meta?.endpoints ?? [];
  const trusts = meta?.supportedTrust ?? meta?.supportedTrusts ?? [];
  const hasX402 = meta?.x402Support || meta?.x402support || false;

  const explorer = networkAgent ? explorerUrl(networkAgent.chain_id) : null;

  return (
    <div className="space-y-6">
      {/* Agent Profile */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
        <div className="flex gap-5">
          {imageUrl && (
            <img
              src={imageUrl}
              alt={agent?.name || id}
              className="w-20 h-20 rounded-lg object-cover border border-gray-700 flex-shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-bold truncate">{networkAgent?.name || agent?.name || id}</h3>
              {agent?.status && (
                <Badge label={agent.status} variant={agent.status === "active" ? "low" : "medium"} />
              )}
            </div>
            {description && (
              <p className="text-sm text-gray-400 mt-1 line-clamp-3">{description}</p>
            )}
            <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-gray-500">
              {agent?.category && <span className="bg-gray-800 px-2 py-0.5 rounded">{agent.category}</span>}
              {agent?.current_tier && <span className="bg-gray-800 px-2 py-0.5 rounded uppercase">{agent.current_tier}</span>}
              {agent?.protocols?.map((p) => (
                <span key={p} className="bg-gray-800 px-2 py-0.5 rounded">{p}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Platform Stats */}
      {agent && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
          <h4 className="text-sm font-semibold text-gray-400 mb-4">Platform Stats</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total Requests" value={agent.total_requests?.toLocaleString() ?? "0"} />
            <StatCard label="Total Revenue" value={`$${(agent.total_revenue_usdc ?? 0).toFixed(2)}`} />
            <StatCard label="Avg Response" value={`${(agent.avg_response_ms ?? 0).toFixed(0)}ms`} />
            <StatCard label="Gateway" value={agent.gateway_enabled ? "Enabled" : "Disabled"} />
          </div>
        </div>
      )}

      {/* On-chain Identity */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
        <h4 className="text-sm font-semibold text-gray-400 mb-4">On-chain Identity</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InfoRow label="Agent ID" value={agent?.agent_id || id} mono />
          {agent?.erc8004_token_id != null && (
            <InfoRow label="Token ID" value={`#${agent.erc8004_token_id}`} />
          )}
          {networkAgent && (
            <InfoRow label="Chain" value={chainName(networkAgent.chain_id)} />
          )}
          {(agent?.evm_address || networkAgent?.owner_address) && (
            <InfoRow
              label="Owner"
              value={agent?.evm_address || networkAgent?.owner_address || ""}
              mono
              truncate
              href={explorer ? `${explorer}/address/${agent?.evm_address || networkAgent?.owner_address}` : undefined}
            />
          )}
          {agent?.reputation_score != null && agent.reputation_score > 0 && (
            <InfoRow label="Reputation Score" value={agent.reputation_score.toFixed(1)} />
          )}
          {agent?.agent_uri && (
            <AgentURIRow uri={agent.agent_uri} />
          )}
          {agent?.created_at && (
            <InfoRow label="Registered" value={new Date(agent.created_at).toLocaleDateString()} />
          )}
          {networkAgent?.synced_at && (
            <InfoRow label="Last Synced" value={new Date(networkAgent.synced_at).toLocaleString()} />
          )}
        </div>
      </div>

      {/* Capabilities */}
      {(hasX402 || trusts.length > 0) && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
          <h4 className="text-sm font-semibold text-gray-400 mb-4">Capabilities</h4>
          <div className="flex flex-wrap gap-2">
            {hasX402 && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-green-900/30 text-green-400 border border-green-800/50">
                x402 Payments
              </span>
            )}
            {trusts.map((t) => (
              <span key={t} className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full bg-blue-900/30 text-blue-400 border border-blue-800/50">
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Services / Endpoints */}
      {services.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
          <h4 className="text-sm font-semibold text-gray-400 mb-4">Services</h4>
          <div className="space-y-3">
            {services.map((svc, i) => (
              <div key={i} className="p-3 bg-gray-950 rounded-lg border border-gray-800">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-white">{svc.name}</span>
                  {svc.version && <span className="text-xs text-gray-500">v{svc.version}</span>}
                </div>
                <p className="text-xs font-mono text-gray-400 break-all">{svc.endpoint}</p>
                {(svc.skills?.length || svc.domains?.length) && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {svc.skills?.map((s) => (
                      <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-purple-900/30 text-purple-400">{s}</span>
                    ))}
                    {svc.domains?.map((d) => (
                      <span key={d} className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-900/30 text-cyan-400">{d}</span>
                    ))}
                  </div>
                )}
                {(svc.mcpTools?.length || svc.mcpPrompts?.length || svc.mcpResources?.length) && (
                  <div className="mt-2 space-y-1">
                    {svc.mcpTools && svc.mcpTools.length > 0 && (
                      <p className="text-[10px] text-gray-500">
                        <span className="text-gray-600">MCP Tools:</span> {svc.mcpTools.join(", ")}
                      </p>
                    )}
                    {svc.mcpPrompts && svc.mcpPrompts.length > 0 && (
                      <p className="text-[10px] text-gray-500">
                        <span className="text-gray-600">MCP Prompts:</span> {svc.mcpPrompts.join(", ")}
                      </p>
                    )}
                    {svc.mcpResources && svc.mcpResources.length > 0 && (
                      <p className="text-[10px] text-gray-500">
                        <span className="text-gray-600">MCP Resources:</span> {svc.mcpResources.join(", ")}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Raw Metadata (collapsible) */}
      {meta && (
        <details className="bg-gray-900 border border-gray-800 rounded-lg">
          <summary className="p-5 text-sm font-semibold text-gray-400 cursor-pointer hover:text-gray-300 transition-colors">
            Raw Metadata
          </summary>
          <div className="px-5 pb-5">
            <pre className="text-xs font-mono text-gray-400 bg-gray-950 p-4 rounded-lg border border-gray-800 overflow-x-auto max-h-[400px] overflow-y-auto">
              {JSON.stringify(meta, null, 2)}
            </pre>
          </div>
        </details>
      )}

    </div>
  );
}

function AgentURIRow({ uri }: { uri: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(uri);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-xs text-gray-500">Agent URI</span>
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-mono text-gray-300 truncate">{uri}</span>
        <button
          onClick={handleCopy}
          title={copied ? "Copied!" : "Copy URI"}
          className="shrink-0 p-0.5 text-gray-500 hover:text-gray-300 transition-colors"
        >
          {copied ? (
            <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono,
  truncate: doTruncate,
  href,
}: {
  label: string;
  value: string;
  mono?: boolean;
  truncate?: boolean;
  href?: string;
}) {
  const valClass = `text-sm ${mono ? "font-mono" : ""} ${doTruncate ? "truncate" : "break-all"} ${href ? "text-blue-400 hover:text-blue-300" : "text-gray-300"}`;
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-xs text-gray-500">{label}</span>
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className={valClass}>{value}</a>
      ) : (
        <span className={valClass}>{value}</span>
      )}
    </div>
  );
}

/* ================================================
   Tab Components
   ================================================ */

const tooltipStyle = {
  backgroundColor: "#111827",
  border: "1px solid #1F2937",
  borderRadius: "8px",
  fontSize: 12,
  boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
};

function DeltaBadge({ value }: { value: number }) {
  if (value === 0) return null;
  const positive = value > 0;
  return (
    <span
      className={`inline-flex items-center text-xs font-medium px-1.5 py-0.5 rounded ${
        positive
          ? "text-green-400 bg-green-900/20"
          : "text-red-400 bg-red-900/20"
      }`}
    >
      {positive ? "+" : ""}
      {value.toFixed(1)}%
    </span>
  );
}

/* ---------- Analytics ---------- */

const PROTOCOL_COLORS: Record<string, string> = {
  "sdk-mcp": "#3B82F6",
  "sdk-a2a": "#8B5CF6",
  "gateway-mcp": "#10B981",
  "gateway-a2a": "#F59E0B",
  "sdk-http": "#6B7280",
  "gateway-http": "#9CA3AF",
};

function protoKey(source: string, protocol: string): string {
  return `${source}-${protocol}`;
}

function protoLabel(source: string, protocol: string): string {
  return `${source.toUpperCase()} · ${protocol.toUpperCase()}`;
}

interface AnalyticsTabProps {
  stats: { total_requests: number; today_requests: number; week_requests: number; month_requests: number; total_revenue_usdc: number; avg_response_ms: number; error_rate: number } | null;
  chartData: { label: string; requests: number; unique_customers: number; revenue: number; errors: number; date: string }[];
  thisWeekRequests: number;
  requestsDelta: number;
  thisWeekCustomers: number;
  customersDelta: number;
  totalCustomers: number;
  analytics: AnalyticsReport | null;
  funnel: FunnelReport | null;
}

function AnalyticsTab({ stats, chartData, thisWeekRequests, totalCustomers, analytics, funnel }: AnalyticsTabProps) {
  // Collect all unique source-protocol keys from data
  const allKeys = new Set<string>();
  if (analytics?.daily_by_protocol) {
    for (const d of analytics.daily_by_protocol) {
      allKeys.add(protoKey(d.source, d.protocol));
    }
  }
  const sortedKeys = Array.from(allKeys).sort();

  // Build stacked daily chart data from source×protocol breakdown
  const dailyProtoChart = (() => {
    if (!analytics?.daily_by_protocol?.length) return null;
    const byDate: Record<string, Record<string, number> & { date: string; label: string }> = {};
    for (const d of analytics.daily_by_protocol) {
      if (!byDate[d.date]) {
        const label = d.date.slice(5); // MM-DD
        const init: Record<string, number> & { date: string; label: string } = { date: d.date, label } as never;
        for (const k of sortedKeys) init[k] = 0;
        byDate[d.date] = init;
      }
      const key = protoKey(d.source, d.protocol);
      byDate[d.date][key] = d.requests;
    }
    return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
  })();

  const health = analytics?.health;
  const proto = analytics?.protocol;
  const tools = analytics?.tool_ranking;
  const cust = analytics?.customers;
  const mcpTools = analytics?.mcp_tools;
  const a2aPartners = analytics?.a2a_partners;
  const a2aEndpoints = analytics?.a2a_endpoints;
  const rev = analytics?.revenue;

  return (
    <div className="space-y-6">
      {/* Row 1: Summary Cards */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Total Requests</p>
          <p className="text-2xl font-bold mt-1">{stats?.total_requests?.toLocaleString() ?? "—"}</p>
          <p className="text-xs text-gray-500 mt-1">This week: {thisWeekRequests.toLocaleString()}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Success Rate</p>
          <p className={`text-2xl font-bold mt-1 ${(health?.success_rate ?? 1) >= 0.95 ? "text-green-400" : "text-yellow-400"}`}>
            {health ? `${(health.success_rate * 100).toFixed(1)}%` : "—"}
          </p>
          <p className="text-xs text-gray-500 mt-1">Last {health?.window_minutes ?? 60}m</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Error Rate</p>
          <p className={`text-2xl font-bold mt-1 ${(health?.error_rate ?? 0) > 0.05 ? "text-red-400" : "text-green-400"}`}>
            {health ? `${(health.error_rate * 100).toFixed(1)}%` : "—"}
          </p>
          <p className="text-xs text-gray-500 mt-1">{health?.error_count ?? 0} errors</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">x402 Payments</p>
          <p className="text-2xl font-bold mt-1 text-emerald-400">
            {rev ? `$${rev.total_revenue.toFixed(2)}` : "—"}
          </p>
          <p className="text-xs text-gray-500 mt-1">{rev?.payment_count ?? 0} payments</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Customers</p>
          <p className="text-2xl font-bold mt-1">{cust?.total_customers ?? totalCustomers}</p>
          <p className="text-xs text-gray-500 mt-1">
            {cust ? `+${cust.new_this_week} new this week` : `Today: ${stats?.today_requests?.toLocaleString() ?? 0} reqs`}
          </p>
        </div>
      </div>

      {/* Row 2: Protocol Analytics */}
      {proto && proto.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          {/* Protocol Distribution */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
            <h3 className="text-sm font-medium text-gray-400 mb-4">Protocol Distribution</h3>
            <div className="space-y-3">
              {proto.map((p) => {
                const key = protoKey(p.source, p.protocol);
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-white">{protoLabel(p.source, p.protocol)}</span>
                      <span className="text-gray-400">{p.request_count.toLocaleString()} ({p.percentage.toFixed(1)}%)</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{
                          width: `${Math.max(p.percentage, 1)}%`,
                          backgroundColor: PROTOCOL_COLORS[key] || "#6B7280",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Protocol Performance */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
            <h3 className="text-sm font-medium text-gray-400 mb-4">Protocol Performance</h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-gray-800">
                  <th className="text-left pb-2">Source</th>
                  <th className="text-left pb-2">Protocol</th>
                  <th className="text-right pb-2">Avg Latency</th>
                  <th className="text-right pb-2">P95</th>
                  <th className="text-right pb-2">Error Rate</th>
                </tr>
              </thead>
              <tbody>
                {proto.map((p) => (
                  <tr key={protoKey(p.source, p.protocol)} className="border-b border-gray-800/50">
                    <td className="py-2 font-medium text-white uppercase">{p.source}</td>
                    <td className="py-2 font-medium text-white uppercase">{p.protocol}</td>
                    <td className="py-2 text-right text-gray-300 font-mono">{p.avg_response_ms.toFixed(0)}ms</td>
                    <td className="py-2 text-right text-gray-300 font-mono">{p.p95_response_ms.toFixed(0)}ms</td>
                    <td className={`py-2 text-right font-mono ${p.error_rate > 0.05 ? "text-red-400" : "text-green-400"}`}>
                      {(p.error_rate * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Row 3: Daily Chart — source×protocol stacked or fallback */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
        <h3 className="text-sm font-medium text-gray-400 mb-4">
          {dailyProtoChart ? "Requests by Source × Protocol (30 days)" : "Requests (30 days)"}
        </h3>
        <ResponsiveContainer width="100%" height={280}>
          {dailyProtoChart ? (
            <AreaChart data={dailyProtoChart}>
              <defs>
                {sortedKeys.map((key) => {
                  const color = PROTOCOL_COLORS[key] || "#6B7280";
                  return (
                    <linearGradient key={key} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                  );
                })}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#9CA3AF" }} />
              {sortedKeys.map((key) => {
                const color = PROTOCOL_COLORS[key] || "#6B7280";
                const [src, proto] = key.split("-");
                return (
                  <Area
                    key={key}
                    type="monotone"
                    dataKey={key}
                    name={`${src.toUpperCase()} · ${proto.toUpperCase()}`}
                    stackId="1"
                    stroke={color}
                    strokeWidth={2}
                    fill={`url(#grad-${key})`}
                  />
                );
              })}
            </AreaChart>
          ) : (
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="reqGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#9CA3AF" }} />
              <Area type="monotone" dataKey="requests" stroke="#3B82F6" strokeWidth={2} fill="url(#reqGrad)" />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Protocol Conversion Funnel */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-medium text-gray-400">Protocol Conversion Funnel</h3>
          {funnel?.summary && (
            <div className="flex gap-4 text-xs text-gray-500">
              <span>A2A Total: <span className="text-purple-400 font-mono">{funnel.summary.a2a_customers}</span></span>
              <span>A2A→Paid: <span className="text-green-400 font-mono">{(funnel.summary.a2a_to_paid_rate * 100).toFixed(1)}%</span></span>
              <span>Paying: <span className="text-emerald-400 font-mono">{funnel.summary.paid_customers}</span></span>
            </div>
          )}
        </div>
        {funnel?.summary ? (() => {
          const s = funnel.summary;
          const maxCount = Math.max(s.mcp_customers, 1);
          const stages = [
            { label: "MCP Customers", count: s.mcp_customers, rate: null as number | null, color: "#3B82F6" },
            { label: "MCP → A2A", count: s.mcp_to_a2a, rate: s.mcp_to_a2a_rate, color: "#8B5CF6" },
            { label: "MCP → A2A → Paid", count: s.mcp_to_a2a_paid, rate: s.full_funnel_rate, color: "#10B981" },
          ];
          return (
            <div className="space-y-4">
              {stages.map((st) => (
                <div key={st.label}>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-gray-400">{st.label}</span>
                    <span className="text-gray-500 font-mono">
                      {st.count}{st.rate !== null && ` (${(st.rate * 100).toFixed(1)}%)`}
                    </span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-3">
                    <div
                      className="h-3 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.max((st.count / maxCount) * 100, st.count > 0 ? 2 : 0)}%`,
                        backgroundColor: st.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          );
        })() : (
          <p className="text-xs text-gray-600">No funnel data yet. Customers using MCP and A2A protocols will appear here.</p>
        )}
      </div>

      {/* Conversion Trend (Daily) */}
      {funnel?.daily_trend && funnel.daily_trend.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Conversion Trend (Daily Unique Customers)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={funnel.daily_trend.map(d => ({ ...d, label: d.date.slice(5).replace("-", "/") }))}>
              <defs>
                <linearGradient id="funnelMcp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="funnelA2a" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="funnelPaid" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
              <XAxis dataKey="label" tick={{ fill: "#6B7280", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#6B7280", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#9CA3AF" }} />
              <Area type="monotone" dataKey="mcp_customers" name="MCP" stroke="#3B82F6" fill="url(#funnelMcp)" strokeWidth={2} />
              <Area type="monotone" dataKey="a2a_customers" name="A2A" stroke="#8B5CF6" fill="url(#funnelA2a)" strokeWidth={2} />
              <Area type="monotone" dataKey="paid_customers" name="Paid" stroke="#10B981" fill="url(#funnelPaid)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Customer Journey Table */}
      {funnel?.journeys && funnel.journeys.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Customer Journeys (MCP → A2A Converts)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-gray-800">
                  <th className="text-left py-2 pr-4">Customer</th>
                  <th className="text-center py-2 px-2">MCP</th>
                  <th className="text-center py-2 px-2">A2A</th>
                  <th className="text-center py-2 px-2">Paid</th>
                  <th className="text-right py-2 px-2">Revenue</th>
                  <th className="text-right py-2 px-2">Days to Convert</th>
                  <th className="text-right py-2 pl-2">Requests</th>
                </tr>
              </thead>
              <tbody>
                {funnel.journeys.map((j) => (
                  <tr key={j.customer_id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="py-2 pr-4 font-mono text-gray-300">{j.customer_id}</td>
                    <td className="py-2 px-2 text-center">{j.has_mcp ? <span className="text-blue-400">&#10003;</span> : <span className="text-gray-700">&mdash;</span>}</td>
                    <td className="py-2 px-2 text-center">{j.has_a2a ? <span className="text-purple-400">&#10003;</span> : <span className="text-gray-700">&mdash;</span>}</td>
                    <td className="py-2 px-2 text-center">{j.has_a2a_paid ? <span className="text-green-400">&#10003;</span> : <span className="text-gray-700">&mdash;</span>}</td>
                    <td className="py-2 px-2 text-right font-mono text-gray-300">${j.total_revenue.toFixed(4)}</td>
                    <td className="py-2 px-2 text-right font-mono text-gray-400">{j.days_to_convert != null ? `${j.days_to_convert.toFixed(1)}d` : "—"}</td>
                    <td className="py-2 pl-2 text-right font-mono text-gray-400">{j.total_requests}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Row 4: Tool Ranking + Revenue */}
      <div className="grid grid-cols-2 gap-4">
        {/* Tool Usage Ranking */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Tool Usage Ranking</h3>
          {tools && tools.length > 0 ? (
            <div className="space-y-1">
              {tools.slice(0, 10).map((t, i) => (
                <div key={t.tool_name} className={`flex items-center gap-3 px-3 py-2 rounded ${i % 2 === 0 ? "bg-gray-800/30" : ""}`}>
                  <span className={`text-xs font-bold w-5 text-right ${i < 3 ? "text-yellow-400" : "text-gray-500"}`}>
                    {i + 1}
                  </span>
                  <span className="text-sm text-white flex-1 font-mono truncate">{t.tool_name}</span>
                  <span className="text-xs text-gray-400 font-mono">{t.call_count.toLocaleString()} calls</span>
                  <span className="text-xs text-gray-500 font-mono">{t.avg_response_ms.toFixed(0)}ms</span>
                  {t.revenue > 0 && (
                    <span className="text-xs text-emerald-400 font-mono">${t.revenue.toFixed(2)}</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-600">No tool usage data yet</p>
          )}
        </div>

        {/* Revenue Summary */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Revenue Summary</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-800/50 rounded-lg p-3">
              <p className="text-xs text-gray-500 uppercase">Total Revenue</p>
              <p className="text-xl font-bold text-emerald-400 mt-1">${rev?.total_revenue?.toFixed(2) ?? "0.00"}</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3">
              <p className="text-xs text-gray-500 uppercase">Payments</p>
              <p className="text-xl font-bold mt-1">{rev?.payment_count ?? 0}</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3">
              <p className="text-xs text-gray-500 uppercase">Avg / Request</p>
              <p className="text-xl font-bold mt-1">${rev?.avg_per_request?.toFixed(4) ?? "0.00"}</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3">
              <p className="text-xs text-gray-500 uppercase">ARPU</p>
              <p className="text-xl font-bold mt-1">${rev?.arpu?.toFixed(4) ?? "0.00"}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Row 5: MCP Analysis */}
      {mcpTools && mcpTools.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          {/* MCP Tool Ranking */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
            <h3 className="text-sm font-medium text-gray-400 mb-4">MCP Tool Ranking</h3>
            <div className="space-y-1">
              {mcpTools.slice(0, 10).map((t, i) => (
                <div key={t.tool_name} className={`flex items-center gap-3 px-3 py-2 rounded ${i % 2 === 0 ? "bg-gray-800/30" : ""}`}>
                  <span className={`text-xs font-bold w-5 text-right ${i < 3 ? "text-blue-400" : "text-gray-500"}`}>
                    {i + 1}
                  </span>
                  <span className="text-sm text-white flex-1 font-mono truncate">{t.tool_name}</span>
                  <span className="text-xs text-gray-400 font-mono">{t.call_count.toLocaleString()}</span>
                  <span className="text-xs text-gray-500 font-mono">{t.avg_response_ms.toFixed(0)}ms</span>
                  {t.error_rate > 0 && (
                    <span className={`text-xs font-mono ${t.error_rate > 0.05 ? "text-red-400" : "text-gray-500"}`}>
                      {(t.error_rate * 100).toFixed(1)}%
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* MCP Tool Revenue */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
            <h3 className="text-sm font-medium text-gray-400 mb-4">MCP Tool Revenue</h3>
            {mcpTools.some((t) => t.revenue > 0) ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={mcpTools.filter((t) => t.revenue > 0).slice(0, 8)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                  <YAxis type="category" dataKey="tool_name" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} width={100} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value: number | undefined) => [`$${(value ?? 0).toFixed(4)}`, "Revenue"]} />
                  <Bar dataKey="revenue" fill="#3B82F6" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[240px]">
                <p className="text-sm text-gray-600">No x402 payments for MCP tools yet</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Row 6: A2A Network */}
      {((a2aPartners && a2aPartners.length > 0) || (a2aEndpoints && a2aEndpoints.length > 0)) && (
        <div className="grid grid-cols-2 gap-4">
          {/* A2A Partners */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
            <h3 className="text-sm font-medium text-gray-400 mb-4">A2A Partners</h3>
            {a2aPartners && a2aPartners.length > 0 ? (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-800">
                    <th className="text-left pb-2">Agent</th>
                    <th className="text-right pb-2">Calls</th>
                    <th className="text-right pb-2">Latency</th>
                    <th className="text-right pb-2">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {a2aPartners.map((p) => (
                    <tr key={p.customer_id} className="border-b border-gray-800/50">
                      <td className="py-2 text-white font-mono truncate max-w-[140px]">{p.customer_id}</td>
                      <td className="py-2 text-right text-gray-300 font-mono">{p.call_count.toLocaleString()}</td>
                      <td className="py-2 text-right text-gray-400 font-mono">{p.avg_response_ms.toFixed(0)}ms</td>
                      <td className="py-2 text-right text-emerald-400 font-mono">
                        {p.revenue > 0 ? `$${p.revenue.toFixed(2)}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-gray-600">No A2A partners yet</p>
            )}
          </div>

          {/* A2A Endpoints */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
            <h3 className="text-sm font-medium text-gray-400 mb-4">A2A Endpoints</h3>
            {a2aEndpoints && a2aEndpoints.length > 0 ? (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-800">
                    <th className="text-left pb-2">Method</th>
                    <th className="text-left pb-2">Endpoint</th>
                    <th className="text-right pb-2">Calls</th>
                    <th className="text-right pb-2">Latency</th>
                    <th className="text-right pb-2">Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {a2aEndpoints.map((e) => (
                    <tr key={`${e.method}-${e.endpoint}`} className="border-b border-gray-800/50">
                      <td className="py-2 text-blue-400 font-mono">{e.method}</td>
                      <td className="py-2 text-white font-mono truncate max-w-[180px]">{e.endpoint}</td>
                      <td className="py-2 text-right text-gray-300 font-mono">{e.call_count.toLocaleString()}</td>
                      <td className="py-2 text-right text-gray-400 font-mono">{e.avg_response_ms.toFixed(0)}ms</td>
                      <td className={`py-2 text-right font-mono ${e.error_rate > 0.05 ? "text-red-400" : "text-green-400"}`}>
                        {(e.error_rate * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-gray-600">No A2A endpoint data yet</p>
            )}
          </div>
        </div>
      )}

      {/* Row 7: Customer Intelligence */}
      {cust && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
            <h3 className="text-sm font-medium text-gray-400 mb-4">Customer Overview</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">New</p>
                <p className="text-2xl font-bold text-blue-400">{cust.new_this_week}</p>
                <p className="text-xs text-gray-500">this week</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">Returning</p>
                <p className="text-2xl font-bold text-purple-400">{cust.returning_this_week}</p>
                <p className="text-xs text-gray-500">this week</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">Total</p>
                <p className="text-2xl font-bold">{cust.total_customers}</p>
                <p className="text-xs text-gray-500">all time</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
            <h3 className="text-sm font-medium text-gray-400 mb-4">Top Callers</h3>
            {cust.top_callers.length > 0 ? (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-800">
                    <th className="text-left pb-2">Customer</th>
                    <th className="text-right pb-2">Requests</th>
                    <th className="text-right pb-2">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {cust.top_callers.map((tc) => (
                    <tr key={tc.customer_id} className="border-b border-gray-800/50">
                      <td className="py-2 text-white font-mono truncate max-w-[120px]">{tc.customer_id}</td>
                      <td className="py-2 text-right text-gray-300 font-mono">{tc.request_count.toLocaleString()}</td>
                      <td className="py-2 text-right text-emerald-400 font-mono">${tc.revenue.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-gray-600">No customer data yet</p>
            )}
          </div>
        </div>
      )}

      {/* Row 8: Health Monitoring */}
      {health && health.total_requests > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-400">Health Monitoring</h3>
            <span className="text-xs text-gray-600">Last {health.window_minutes} minutes</span>
          </div>
          <div className="space-y-4">
            {[
              { label: "Success", rate: health.success_rate, count: health.total_requests - health.error_count, color: "#22C55E" },
              { label: "402 Payment", rate: health.payment_rate, count: health.payment_count, color: "#F59E0B" },
              { label: "Timeout", rate: health.timeout_rate, count: health.timeout_count, color: "#EF4444" },
            ].map((m) => (
              <div key={m.label}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-400">{m.label}</span>
                  <span className="text-gray-500 font-mono">{(m.rate * 100).toFixed(1)}% ({m.count})</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{ width: `${Math.max(m.rate * 100, 0.5)}%`, backgroundColor: m.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

/* ---------- Speed Insights ---------- */

interface SpeedInsightsTabProps {
  performance: {
    p50_response_ms: number;
    p95_response_ms: number;
    p99_response_ms: number;
    avg_response_ms: number;
    error_rate: number;
    total_requests: number;
    success_requests: number;
    error_requests: number;
    requests_per_min: number;
    uptime: number;
  } | null;
}

function SpeedInsightsTab({ performance }: SpeedInsightsTabProps) {
  if (!performance) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center">
        <p className="text-gray-500 text-sm">No performance data yet. Start sending requests to see speed insights.</p>
      </div>
    );
  }

  const latencyData = [
    { label: "P50", value: performance.p50_response_ms },
    { label: "P95", value: performance.p95_response_ms },
    { label: "P99", value: performance.p99_response_ms },
  ];

  return (
    <div className="space-y-6">
      {/* Headline metric */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Avg Response</p>
          <p className="text-2xl font-bold mt-1">{performance.avg_response_ms.toFixed(0)}<span className="text-sm font-normal text-gray-500 ml-1">ms</span></p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Error Rate</p>
          <p className={`text-2xl font-bold mt-1 ${performance.error_rate > 0.05 ? "text-red-400" : "text-green-400"}`}>
            {(performance.error_rate * 100).toFixed(1)}%
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Uptime</p>
          <p className={`text-2xl font-bold mt-1 ${performance.uptime >= 0.99 ? "text-green-400" : "text-yellow-400"}`}>
            {(performance.uptime * 100).toFixed(2)}%
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Throughput</p>
          <p className="text-2xl font-bold mt-1">{performance.requests_per_min.toFixed(1)}<span className="text-sm font-normal text-gray-500 ml-1">rpm</span></p>
        </div>
      </div>

      {/* Latency percentiles bar chart */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
        <h3 className="text-sm font-medium text-gray-400 mb-4">Response Time Distribution</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={latencyData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}ms`} />
            <YAxis type="category" dataKey="label" tick={{ fontSize: 12, fill: "#9CA3AF", fontWeight: 500 }} axisLine={false} tickLine={false} width={40} />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value: number | undefined) => [`${(value ?? 0).toFixed(1)}ms`, "Latency"]}
            />
            <Bar dataKey="value" fill="#3B82F6" radius={[0, 4, 4, 0]} barSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Success / Error breakdown */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Request Breakdown</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-gray-300">Success</span>
              </div>
              <span className="font-mono text-gray-300">{performance.success_requests.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-400" />
                <span className="text-gray-300">Errors</span>
              </div>
              <span className="font-mono text-gray-300">{performance.error_requests.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-sm border-t border-gray-800 pt-2">
              <span className="text-gray-500">Total</span>
              <span className="font-mono text-gray-300">{performance.total_requests.toLocaleString()}</span>
            </div>
            {/* Progress bar */}
            <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full"
                style={{ width: `${((1 - performance.error_rate) * 100).toFixed(1)}%` }}
              />
            </div>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Detailed Latency</h3>
          <div className="space-y-2 text-sm">
            <MetricRow label="P50" value={`${performance.p50_response_ms.toFixed(0)}ms`} />
            <MetricRow label="P95" value={`${performance.p95_response_ms.toFixed(0)}ms`} />
            <MetricRow label="P99" value={`${performance.p99_response_ms.toFixed(0)}ms`} />
            <MetricRow label="Average" value={`${performance.avg_response_ms.toFixed(0)}ms`} />
            <div className="border-t border-gray-800 pt-2">
              <MetricRow
                label="Error Rate"
                value={`${(performance.error_rate * 100).toFixed(1)}%`}
                color={performance.error_rate > 0.05 ? "text-red-400" : "text-green-400"}
              />
              <MetricRow
                label="Uptime"
                value={`${(performance.uptime * 100).toFixed(2)}%`}
                color={performance.uptime >= 0.99 ? "text-green-400" : "text-yellow-400"}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Observability ---------- */

interface ObservabilityTabProps {
  recentLogs: {
    id: number;
    method: string;
    path: string;
    status_code: number;
    response_ms: number;
    x402_amount?: number;
    customer_id?: string;
    tool_name?: string;
    created_at: string;
  }[];
  chartData: { label: string; errors: number; requests: number }[];
  stats: { error_rate: number; total_requests: number } | null;
}

function ObservabilityTab({ recentLogs, chartData, stats }: ObservabilityTabProps) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 20;

  const filtered = recentLogs.filter((log) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      log.method.toLowerCase().includes(q) ||
      log.path.toLowerCase().includes(q) ||
      String(log.status_code).includes(q) ||
      (log.customer_id || "").toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * perPage, safePage * perPage);

  return (
    <div className="space-y-6">
      {/* Error metrics */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Error Rate</p>
          <p className={`text-2xl font-bold mt-1 ${(stats?.error_rate ?? 0) > 0.05 ? "text-red-400" : "text-green-400"}`}>
            {stats?.error_rate != null ? `${(stats.error_rate * 100).toFixed(1)}%` : "—"}
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Total Requests</p>
          <p className="text-2xl font-bold mt-1">{stats?.total_requests?.toLocaleString() ?? "—"}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Recent Errors</p>
          <p className="text-2xl font-bold mt-1 text-red-400">
            {recentLogs.filter((l) => l.status_code >= 400).length}
            <span className="text-sm font-normal text-gray-500 ml-1">/ {recentLogs.length}</span>
          </p>
        </div>
      </div>

      {/* Daily errors chart */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
        <h3 className="text-sm font-medium text-gray-400 mb-4">Errors Over Time</h3>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="errGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#EF4444" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#EF4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#9CA3AF" }} />
            <Area type="monotone" dataKey="errors" name="Errors" stroke="#EF4444" strokeWidth={2} fill="url(#errGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Request logs table */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between gap-3">
          <h3 className="text-sm font-medium text-gray-400">Request Logs</h3>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search path, method, status, customer..."
              className="px-3 py-1.5 bg-gray-950 border border-gray-700 rounded-md text-xs text-white placeholder-gray-600 focus:outline-none focus:border-gray-500 w-72"
            />
            <span className="text-xs text-gray-600 whitespace-nowrap">{filtered.length} entries</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500">
                <th className="text-left p-3">Method</th>
                <th className="text-left p-3">Path</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Latency</th>
                <th className="text-left p-3">Customer</th>
                <th className="text-left p-3">Amount</th>
                <th className="text-left p-3">Time</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((log) => (
                <tr key={log.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="p-3"><span className="font-mono text-blue-400">{log.method}</span></td>
                  <td className="p-3 text-gray-300 truncate max-w-[200px]">{log.path}</td>
                  <td className="p-3"><StatusCode code={log.status_code} /></td>
                  <td className="p-3 text-gray-400 font-mono">{log.response_ms.toFixed(0)}ms</td>
                  <td className="p-3 text-gray-500 font-mono truncate max-w-[100px]">{log.customer_id || "—"}</td>
                  <td className="p-3 text-gray-400 font-mono">{log.x402_amount ? `$${log.x402_amount.toFixed(2)}` : "—"}</td>
                  <td className="p-3 text-gray-500">{timeAgo(log.created_at)}</td>
                </tr>
              ))}
              {paged.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-gray-600">
                    {search ? "No logs matching your search" : "No request logs yet. Integrate the SDK to start collecting data."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-gray-800 flex items-center justify-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="px-2 py-1 rounded text-xs text-gray-400 hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Prev
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-7 h-7 rounded text-xs font-medium transition-colors ${
                  p === safePage
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:bg-gray-800"
                }`}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="px-2 py-1 rounded text-xs text-gray-400 hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Revenue ---------- */

interface RevenueTabProps {
  stats: { total_revenue_usdc: number } | null;
  revenue: { arpu: number; total_revenue: number; periods: { period: string; amount: number; count: number }[]; by_tool: { tool_name: string; amount: number; count: number }[] } | null;
  byTool: { tool_name: string; amount: number; count: number }[];
  chartData: { label: string; revenue: number }[];
}

function RevenueTab({ stats, revenue, byTool, chartData }: RevenueTabProps) {
  const totalRevenue = stats?.total_revenue_usdc ?? revenue?.total_revenue ?? 0;

  return (
    <div className="space-y-6">
      {/* Revenue headline */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Total Revenue</p>
          <p className="text-2xl font-bold mt-1 text-green-400">${totalRevenue.toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-1">USDC</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">ARPU</p>
          <p className="text-2xl font-bold mt-1">${revenue?.arpu?.toFixed(2) ?? "0.00"}</p>
          <p className="text-xs text-gray-500 mt-1">avg revenue per user</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Revenue Endpoints</p>
          <p className="text-2xl font-bold mt-1">{byTool.length}</p>
          <p className="text-xs text-gray-500 mt-1">monetized tools</p>
        </div>
      </div>

      {/* Revenue chart */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
        <h3 className="text-sm font-medium text-gray-400 mb-4">Daily Revenue (USDC)</h3>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10B981" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
            <Tooltip
              contentStyle={tooltipStyle}
              labelStyle={{ color: "#9CA3AF" }}
              formatter={(value: number | undefined) => [`$${(value ?? 0).toFixed(2)}`, "Revenue"]}
            />
            <Area type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={2} fill="url(#revGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Revenue by Tool & Revenue Periods */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Revenue by Endpoint</h3>
          {byTool.length > 0 ? (
            <div className="space-y-2">
              {byTool.map((t) => (
                <div key={t.tool_name} className="flex items-center justify-between text-sm">
                  <span className="text-gray-300 truncate mr-2">{t.tool_name}</span>
                  <span className="text-gray-400 font-mono text-xs whitespace-nowrap">
                    ${t.amount.toFixed(2)} <span className="text-gray-600">({t.count})</span>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-600">No endpoint revenue data yet</p>
          )}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Revenue by Period</h3>
          {revenue?.periods && revenue.periods.length > 0 ? (
            <div className="space-y-2">
              {revenue.periods.map((p) => (
                <div key={p.period} className="flex items-center justify-between text-sm">
                  <span className="text-gray-300">{p.period}</span>
                  <span className="text-gray-400 font-mono text-xs whitespace-nowrap">
                    ${p.amount.toFixed(2)} <span className="text-gray-600">({p.count})</span>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-600">No period data yet</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ================================================
   Customers Tab
   ================================================ */

interface CustomersTabProps {
  agentId: string;
  customers: Customer[];
  totalCustomers: number;
}

function CustomersTab({ agentId, customers, totalCustomers }: CustomersTabProps) {
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"total_requests" | "total_revenue" | "last_seen_at" | "error_rate">("total_requests");

  // Filter & sort
  const filtered = customers
    .filter((c) => {
      const q = search.toLowerCase();
      return c.customer_id.toLowerCase().includes(q) ||
        (c.country && c.country.toLowerCase().includes(q)) ||
        (c.city && c.city.toLowerCase().includes(q));
    })
    .sort((a, b) => {
      if (sortBy === "total_requests") return b.total_requests - a.total_requests;
      if (sortBy === "total_revenue") return b.total_revenue - a.total_revenue;
      if (sortBy === "error_rate") return b.error_rate - a.error_rate;
      return new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime();
    });

  const atRisk = customers.filter((c) => c.churn_risk === "medium" || c.churn_risk === "high").length;
  const topRevenue = customers.length > 0
    ? customers.reduce((best, c) => (c.total_revenue > best.total_revenue ? c : best), customers[0])
    : null;

  if (selectedCustomer) {
    return (
      <CustomerDetailView
        agentId={agentId}
        customer={selectedCustomer}
        onBack={() => setSelectedCustomer(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">Total Customers</p>
          <p className="text-2xl font-bold">{totalCustomers}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">Active (Low Risk)</p>
          <p className="text-2xl font-bold text-green-400">{totalCustomers - atRisk}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">At Risk</p>
          <p className="text-2xl font-bold text-yellow-400">{atRisk}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">Top Revenue</p>
          <p className="text-lg font-bold text-emerald-400 truncate">
            {topRevenue ? `$${topRevenue.total_revenue.toFixed(2)}` : "-"}
          </p>
          {topRevenue && (
            <p className="text-xs text-gray-500 font-mono truncate">{topRevenue.customer_id}</p>
          )}
        </div>
      </div>

      {/* Search + Sort */}
      <div className="flex items-center gap-4">
        <input
          type="text"
          placeholder="Search by IP address or location..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-blue-500"
        >
          <option value="total_requests">Sort: Requests</option>
          <option value="total_revenue">Sort: Revenue</option>
          <option value="last_seen_at">Sort: Last Seen</option>
          <option value="error_rate">Sort: Error Rate</option>
        </select>
      </div>

      {/* Customer Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 border-b border-gray-800 text-xs">
              <th className="text-left px-4 py-3">IP Address</th>
              <th className="text-left px-3 py-3">Location</th>
              <th className="text-center px-3 py-3">Status</th>
              <th className="text-right px-3 py-3">Requests</th>
              <th className="text-right px-3 py-3">Revenue</th>
              <th className="text-right px-3 py-3">Avg Response</th>
              <th className="text-right px-3 py-3">Error Rate</th>
              <th className="text-right px-3 py-3">Last Seen</th>
              <th className="text-center px-3 py-3">Risk</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? (
              filtered.map((c) => {
                const status = getActivityStatus(c.last_seen_at);
                return (
                  <tr
                    key={c.id}
                    onClick={() => setSelectedCustomer(c)}
                    className="border-b border-gray-800/50 hover:bg-gray-800/50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-white truncate block max-w-[180px]">
                        {c.customer_id}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {c.country ? (
                        <span className="text-gray-300 text-xs">
                          {c.city ? `${c.city}, ${c.country}` : c.country}
                        </span>
                      ) : (
                        <span className="text-gray-600 text-xs">-</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`inline-block w-2 h-2 rounded-full ${status.color}`} title={status.label} />
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-gray-300">
                      {c.total_requests.toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-emerald-400">
                      ${c.total_revenue.toFixed(2)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-gray-300">
                      {c.avg_response_ms.toFixed(0)}ms
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-gray-300">
                      {(c.error_rate * 100).toFixed(1)}%
                    </td>
                    <td className="px-3 py-3 text-right text-gray-400">
                      {timeAgo(c.last_seen_at)}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <ChurnBadge risk={c.churn_risk} />
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-600">
                  {search ? "No customers match your search" : "No customer data yet"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ================================================
   Customer Detail View
   ================================================ */

interface CustomerDetailViewProps {
  agentId: string;
  customer: Customer;
  onBack: () => void;
}

function CustomerDetailView({ agentId, customer, onBack }: CustomerDetailViewProps) {
  const { data: logsData } = useCustomerLogs(agentId, customer.customer_id);
  const { data: toolsData } = useCustomerTools(agentId, customer.customer_id);
  const { data: dailyData } = useCustomerDaily(agentId, customer.customer_id, 30);

  const logs = logsData?.logs || [];
  const tools = toolsData?.tools || [];
  const dailyStats = dailyData?.stats || [];
  const status = getActivityStatus(customer.last_seen_at);

  const chartData = dailyStats.map((d) => ({
    ...d,
    label: d.date.slice(5).replace("-", "/"),
  }));

  const activeDays = Math.ceil(
    (new Date(customer.last_seen_at).getTime() - new Date(customer.first_seen_at).getTime()) / 86400000
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="text-gray-400 hover:text-white transition-colors text-sm"
        >
          &larr; Back to list
        </button>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold font-mono">{customer.customer_id}</h2>
            {customer.country && (
              <p className="text-sm text-gray-400 mt-1">
                {customer.city ? `${customer.city}, ${customer.country}` : customer.country}
              </p>
            )}
            <div className="flex items-center gap-3 mt-2">
              <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border ${
                status.label === "Active" ? "border-green-800 text-green-400 bg-green-900/20" :
                status.label === "Idle" ? "border-blue-800 text-blue-400 bg-blue-900/20" :
                status.label === "Inactive" ? "border-yellow-800 text-yellow-400 bg-yellow-900/20" :
                "border-red-800 text-red-400 bg-red-900/20"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${status.color}`} />
                {status.label}
              </span>
              <ChurnBadge risk={customer.churn_risk} />
            </div>
          </div>
        </div>

        {/* Identity Info */}
        <div className="grid grid-cols-4 gap-4 mt-4 text-xs">
          <div>
            <p className="text-gray-500">First Seen</p>
            <p className="text-gray-300">{new Date(customer.first_seen_at).toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-gray-500">Last Seen</p>
            <p className="text-gray-300">{timeAgo(customer.last_seen_at)}</p>
          </div>
          <div>
            <p className="text-gray-500">Active Duration</p>
            <p className="text-gray-300">{activeDays}d</p>
          </div>
          <div>
            <p className="text-gray-500">Customer Since</p>
            <p className="text-gray-300">{new Date(customer.first_seen_at).toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">Total Requests</p>
          <p className="text-2xl font-bold">{customer.total_requests.toLocaleString()}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">Total Revenue</p>
          <p className="text-2xl font-bold text-emerald-400">${customer.total_revenue.toFixed(2)}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">Avg Response</p>
          <p className="text-2xl font-bold">{customer.avg_response_ms.toFixed(0)}ms</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">Error Rate</p>
          <p className={`text-2xl font-bold ${customer.error_rate > 0.1 ? "text-red-400" : customer.error_rate > 0.05 ? "text-yellow-400" : "text-green-400"}`}>
            {(customer.error_rate * 100).toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Daily Activity Chart */}
      {chartData.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Daily Activity (30d)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="label" tick={{ fill: "#6B7280", fontSize: 11 }} />
              <YAxis tick={{ fill: "#6B7280", fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: "#1F2937", border: "1px solid #374151", borderRadius: "8px" }}
                labelStyle={{ color: "#9CA3AF" }}
              />
              <Area type="monotone" dataKey="requests" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.1} name="Requests" />
              <Area type="monotone" dataKey="errors" stroke="#EF4444" fill="#EF4444" fillOpacity={0.1} name="Errors" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tool/Endpoint Usage */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
        <h3 className="text-sm font-medium text-gray-400 mb-4">Tool / Endpoint Usage</h3>
        {tools.length > 0 ? (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="text-left pb-2">Tool / Path</th>
                <th className="text-right pb-2">Calls</th>
                <th className="text-right pb-2">Avg Response</th>
                <th className="text-right pb-2">Error Rate</th>
                <th className="text-right pb-2">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {tools.map((t) => (
                <tr key={t.tool_name} className="border-b border-gray-800/50">
                  <td className="py-2 text-white font-mono">{t.tool_name}</td>
                  <td className="py-2 text-right text-gray-300 font-mono">{t.call_count.toLocaleString()}</td>
                  <td className="py-2 text-right text-gray-300 font-mono">{t.avg_response_ms.toFixed(0)}ms</td>
                  <td className="py-2 text-right font-mono">
                    <span className={t.error_rate > 0.1 ? "text-red-400" : t.error_rate > 0.05 ? "text-yellow-400" : "text-gray-300"}>
                      {(t.error_rate * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-2 text-right text-emerald-400 font-mono">${t.revenue.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-gray-600">No tool usage data yet</p>
        )}
      </div>

      {/* Recent Request Logs */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
        <h3 className="text-sm font-medium text-gray-400 mb-4">Recent Requests</h3>
        {logs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-gray-800">
                  <th className="text-left pb-2">Time</th>
                  <th className="text-left pb-2">Method</th>
                  <th className="text-left pb-2">Path</th>
                  <th className="text-center pb-2">Status</th>
                  <th className="text-right pb-2">Response</th>
                  <th className="text-center pb-2">Protocol</th>
                  <th className="text-right pb-2">Amount</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-gray-800/50">
                    <td className="py-2 text-gray-400">{timeAgo(log.created_at)}</td>
                    <td className="py-2">
                      <span className="text-blue-400 font-mono">{log.method}</span>
                    </td>
                    <td className="py-2 text-gray-300 font-mono truncate max-w-[200px]">{log.path}</td>
                    <td className="py-2 text-center"><StatusCode code={log.status_code} /></td>
                    <td className="py-2 text-right text-gray-300 font-mono">{log.response_ms.toFixed(0)}ms</td>
                    <td className="py-2 text-center">
                      {log.protocol && (
                        <span className="text-xs px-1.5 py-0.5 bg-gray-800 rounded text-gray-400">
                          {log.protocol}
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-right font-mono">
                      {log.x402_amount ? (
                        <span className="text-emerald-400">${log.x402_amount.toFixed(4)}</span>
                      ) : (
                        <span className="text-gray-600">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-600">No request logs yet</p>
        )}
      </div>
    </div>
  );
}

/* ================================================
   Customer Helpers
   ================================================ */

function getActivityStatus(lastSeenAt: string): { label: string; color: string } {
  const diffMs = Date.now() - new Date(lastSeenAt).getTime();
  const hours = diffMs / 3600000;
  if (hours < 1) return { label: "Active", color: "bg-green-400" };
  if (hours < 24) return { label: "Idle", color: "bg-blue-400" };
  if (hours < 168) return { label: "Inactive", color: "bg-yellow-400" };
  return { label: "Churned", color: "bg-red-400" };
}

function ChurnBadge({ risk }: { risk: string }) {
  const colors = {
    low: "text-green-400 bg-green-900/20 border-green-800",
    medium: "text-yellow-400 bg-yellow-900/20 border-yellow-800",
    high: "text-red-400 bg-red-900/20 border-red-800",
  };
  const c = colors[risk as keyof typeof colors] || colors.low;
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded border ${c}`}>
      {risk}
    </span>
  );
}

/* ================================================
   Trust Tab
   ================================================ */

interface TrustTabProps {
  agentId: string;
  trustData: TrustScoreResponse | null;
}

function TrustTab({ agentId, trustData }: TrustTabProps) {
  const [reviewScore, setReviewScore] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewerId, setReviewerId] = useState("");
  const [reviewTags, setReviewTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState("");
  const [showForm, setShowForm] = useState(false);

  const breakdown = trustData?.breakdown;
  const reviews = trustData?.reviews || [];
  const totalScore = breakdown?.total_score ?? 0;

  const scoreColor =
    totalScore >= 80 ? "text-green-400" : totalScore >= 50 ? "text-yellow-400" : "text-red-400";
  const ringColor =
    totalScore >= 80 ? "stroke-green-400" : totalScore >= 50 ? "stroke-yellow-400" : "stroke-red-400";

  const COMPONENTS: { key: keyof Pick<NonNullable<typeof breakdown>, "reliability" | "performance" | "activity" | "revenue_quality" | "customer_retention" | "peer_review" | "onchain_score">; label: string; weight: string }[] = [
    { key: "reliability", label: "Reliability", weight: "25%" },
    { key: "performance", label: "Performance", weight: "20%" },
    { key: "activity", label: "Activity", weight: "15%" },
    { key: "revenue_quality", label: "Revenue Quality", weight: "10%" },
    { key: "customer_retention", label: "Customer Retention", weight: "10%" },
    { key: "peer_review", label: "Peer Reviews", weight: "10%" },
    { key: "onchain_score", label: "On-chain", weight: "10%" },
  ];

  const TAG_OPTIONS = ["reliable", "fast", "accurate", "helpful", "innovative", "responsive"];

  const toggleTag = (tag: string) => {
    setReviewTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async () => {
    if (!reviewerId.trim()) {
      setSubmitMsg("Reviewer ID is required");
      return;
    }
    setSubmitting(true);
    setSubmitMsg("");
    try {
      await openApi.submitReview(agentId, {
        reviewer_id: reviewerId.trim(),
        score: reviewScore,
        tags: reviewTags,
        comment: reviewComment.trim(),
      });
      setSubmitMsg("Review submitted!");
      setReviewComment("");
      setReviewTags([]);
      setReviewScore(5);
      setShowForm(false);
    } catch (err) {
      setSubmitMsg(err instanceof Error ? err.message : "Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  };

  if (!trustData) {
    return (
      <div className="text-center text-gray-500 py-12">
        <p>Loading trust data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall Score + Breakdown */}
      <div className="grid grid-cols-3 gap-6">
        {/* Score Circle */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 flex flex-col items-center justify-center">
          <p className="text-xs text-gray-500 mb-3">Trust Score</p>
          <div className="relative w-32 h-32">
            <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="52" fill="none" stroke="#1f2937" strokeWidth="8" />
              <circle
                cx="60" cy="60" r="52" fill="none"
                className={ringColor}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${(totalScore / 100) * 327} 327`}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-3xl font-bold ${scoreColor}`}>
                {totalScore.toFixed(0)}
              </span>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {breakdown?.review_count ?? 0} reviews · {breakdown?.onchain_count ?? 0} on-chain
          </p>
        </div>

        {/* Component Breakdown */}
        <div className="col-span-2 bg-gray-900 border border-gray-800 rounded-lg p-6">
          <p className="text-sm font-medium text-gray-300 mb-4">Score Breakdown</p>
          <div className="space-y-3">
            {COMPONENTS.map((comp) => {
              const val = breakdown?.[comp.key] ?? 0;
              const barColor =
                val >= 80 ? "bg-green-500" : val >= 50 ? "bg-yellow-500" : "bg-red-500";
              return (
                <div key={comp.key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-400">
                      {comp.label}{" "}
                      <span className="text-gray-600">({comp.weight})</span>
                    </span>
                    <span className="text-xs font-mono text-gray-300">{val.toFixed(1)}</span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${barColor}`}
                      style={{ width: `${Math.min(val, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent Reviews */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-medium text-gray-300">
            Recent Reviews ({trustData.review_total})
          </p>
          <button
            onClick={() => setShowForm(!showForm)}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
          >
            {showForm ? "Cancel" : "Write Review"}
          </button>
        </div>

        {/* Submit Review Form */}
        {showForm && (
          <div className="mb-6 p-4 border border-gray-700 rounded-lg space-y-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Your Agent ID or EVM Address</label>
              <input
                type="text"
                value={reviewerId}
                onChange={(e) => setReviewerId(e.target.value)}
                placeholder="my-agent-slug or 0x..."
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Score</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    onClick={() => setReviewScore(s)}
                    className={`w-8 h-8 rounded text-sm font-medium transition-colors ${
                      s <= reviewScore
                        ? "bg-yellow-500/20 text-yellow-400 border border-yellow-600"
                        : "bg-gray-800 text-gray-600 border border-gray-700"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Tags</label>
              <div className="flex flex-wrap gap-1.5">
                {TAG_OPTIONS.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                      reviewTags.includes(tag)
                        ? "border-blue-600 text-blue-400 bg-blue-900/20"
                        : "border-gray-700 text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Comment (optional)</label>
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                rows={2}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg disabled:opacity-50 transition-colors"
              >
                {submitting ? "Submitting..." : "Submit Review"}
              </button>
              {submitMsg && (
                <span className={`text-xs ${submitMsg.includes("submitted") ? "text-green-400" : "text-red-400"}`}>
                  {submitMsg}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Review List */}
        {reviews.length > 0 ? (
          <div className="space-y-3">
            {reviews.map((r) => (
              <div key={r.id} className="border-b border-gray-800/50 pb-3 last:border-0 last:pb-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-gray-400 truncate max-w-[200px]">
                      {r.reviewer_id}
                    </span>
                    <span className="text-yellow-400 text-xs">
                      {"★".repeat(r.score)}{"☆".repeat(5 - r.score)}
                    </span>
                  </div>
                  <span className="text-xs text-gray-600">{timeAgo(r.created_at)}</span>
                </div>
                {r.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {r.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs px-1.5 py-0.5 rounded-full border border-gray-700 text-gray-500"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                {r.comment && (
                  <p className="text-xs text-gray-400 mt-1.5">{r.comment}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-600 text-center py-4">No reviews yet</p>
        )}
      </div>
    </div>
  );
}

/* ================================================
   Utility Components
   ================================================ */

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