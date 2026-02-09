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
} from "@/lib/hooks";
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

type Tab = "overview" | "analytics" | "speed" | "observability" | "revenue" | "settings";

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "analytics", label: "Analytics" },
  { key: "speed", label: "Speed Insights" },
  { key: "observability", label: "Observability" },
  { key: "revenue", label: "Revenue" },
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

  // Fetch all data in parallel (public endpoints, no auth needed)
  const { data: stats } = useAgentStats(id);
  const { data: daily } = useDailyStats(id, 30);
  const { data: customers } = useCustomers(id);
  const { data: revenue } = useRevenue(id, "monthly");
  const { data: performance } = usePerformance(id, "24h");
  const { data: logs } = useLogs(id, 50);

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

  const [gatewayError, setGatewayError] = useState("");

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
              <h3 className="text-lg font-bold truncate">{agent?.name || networkAgent?.name || id}</h3>
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
            <InfoRow label="Agent URI" value={agent.agent_uri} mono truncate />
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

interface AnalyticsTabProps {
  stats: { total_requests: number; today_requests: number; week_requests: number; month_requests: number; total_revenue_usdc: number; avg_response_ms: number; error_rate: number } | null;
  chartData: { label: string; requests: number; unique_customers: number; revenue: number; errors: number; date: string }[];
  thisWeekRequests: number;
  requestsDelta: number;
  thisWeekCustomers: number;
  customersDelta: number;
  totalCustomers: number;
}

function AnalyticsTab({ stats, chartData, thisWeekRequests, requestsDelta, thisWeekCustomers, customersDelta, totalCustomers }: AnalyticsTabProps) {
  return (
    <div className="space-y-6">
      {/* Top-level metric cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Total Requests</p>
          <p className="text-2xl font-bold mt-1">{stats?.total_requests?.toLocaleString() ?? "—"}</p>
          <p className="text-xs text-gray-500 mt-1">This month: {stats?.month_requests?.toLocaleString() ?? "—"}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">This Week</p>
          <div className="flex items-baseline gap-2 mt-1">
            <p className="text-2xl font-bold">{thisWeekRequests.toLocaleString()}</p>
            <DeltaBadge value={requestsDelta} />
          </div>
          <p className="text-xs text-gray-500 mt-1">vs previous week</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Unique Visitors</p>
          <div className="flex items-baseline gap-2 mt-1">
            <p className="text-2xl font-bold">{thisWeekCustomers.toLocaleString()}</p>
            <DeltaBadge value={customersDelta} />
          </div>
          <p className="text-xs text-gray-500 mt-1">this week</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Total Customers</p>
          <p className="text-2xl font-bold mt-1">{totalCustomers.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-1">Today: {stats?.today_requests?.toLocaleString() ?? "—"} reqs</p>
        </div>
      </div>

      {/* Requests area chart */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
        <h3 className="text-sm font-medium text-gray-400 mb-4">Requests</h3>
        <ResponsiveContainer width="100%" height={280}>
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
        </ResponsiveContainer>
      </div>

      {/* Unique Customers area chart */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
        <h3 className="text-sm font-medium text-gray-400 mb-4">Unique Visitors</h3>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="custGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#9CA3AF" }} />
            <Area type="monotone" dataKey="unique_customers" name="Visitors" stroke="#8B5CF6" strokeWidth={2} fill="url(#custGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
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