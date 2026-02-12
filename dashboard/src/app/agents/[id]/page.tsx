"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { StatCard } from "@/components/StatCard";
import { Badge } from "@/components/Badge";
import { CopyButton } from "@/components/CopyButton";
import { CodeBlock } from "@/components/CodeBlock";
import { HealthScoreCard } from "@/components/HealthScoreCard";
import { StatCardWithTrend } from "@/components/StatCardWithTrend";
import { ProtocolBreakdownCards } from "@/components/ProtocolBreakdownCards";
import { ToolPerformanceTable } from "@/components/ToolPerformanceTable";
import { TrendChart } from "@/components/TrendChart";
import { openApi, type Agent, type NetworkAgent, type AgentMetadata, type AgentService } from "@/lib/api";
import { NETWORKS, resolveImageUrl } from "@/lib/networks";
import { updateAgentURI, encodeDataUri } from "@/lib/erc8004";
import { signChallenge } from "@/lib/wallet";
import {
  useAgentStats,
  useDailyStats,
  useCustomers,
  useRevenue,
  usePerformance,
  useLogs,
  useAnalytics,
  useFunnel,
  useCustomerLogs,
  useCustomerTools,
  useCustomerDaily,
} from "@/lib/hooks";
import type { AnalyticsReport, Customer, CustomerToolUsage, RequestLog, DailyStats, FunnelReport } from "@/lib/api";
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

type Tab = "overview" | "analytics" | "speed" | "observability" | "revenue" | "customers" | "settings";

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "analytics", label: "Analytics" },
  { key: "customers", label: "Customers" },
  { key: "revenue", label: "Revenue" },
  { key: "observability", label: "Observability" },
  { key: "speed", label: "Speed Insights" },
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
    const chainId = viewedAgent.chain_id;

    if (chainId) {
      // Use the agent's known chain_id for exact lookup
      openApi.getNetworkAgent(chainId, tokenId)
        .then((na) => setNetworkAgent(na))
        .catch(() => setNetworkAgent(null));
    } else {
      // Fallback: try all chains (legacy agents without chain_id)
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
    }
  }, [viewedAgent?.erc8004_token_id, viewedAgent?.chain_id, walletAddress]);

  const refreshAgent = async () => {
    if (authAgent?.agent_id === id) {
      await login(apiKey!);
    } else if (walletAddress) {
      const { agents } = await openApi.getWalletAgents(walletAddress);
      const found = agents.find((a) => a.agent_id === id);
      if (found) setViewedAgent(found);
    }
  };

  // Fetch all data in parallel (public endpoints, no auth needed)
  const { data: stats } = useAgentStats(id);
  const { data: daily } = useDailyStats(id, 30);
  const { data: customers } = useCustomers(id);
  const { data: revenue } = useRevenue(id, "monthly");
  const { data: performance } = usePerformance(id, "24h");
  const { data: logs } = useLogs(id, 50);
  const { data: analytics } = useAnalytics(id, 30);

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
          <SpeedInsightsTab
            performance={performance}
            analytics={analytics}
            dailyStats={daily}
          />
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
            newThisWeek={analytics?.customers?.new_this_week ?? 0}
            returningThisWeek={analytics?.customers?.returning_this_week ?? 0}
          />
        )}
        {activeTab === "settings" && (
          <SettingsTab
            agent={agent}
            id={id}
            apiKey={apiKey}
            walletAddress={walletAddress}
            networkAgent={networkAgent}
            refreshAgent={refreshAgent}
          />
        )}
      </div>
    </div>
  );
}

/* ---------- Deregister ---------- */

function DeregisterSection({
  agentId,
  apiKey,
  walletAddress
}: {
  agentId: string;
  apiKey: string | null;
  walletAddress: string | null;
}) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleDeregister = async () => {
    if (!apiKey && !walletAddress) {
      setError("Please connect your wallet or log in with API key to deregister");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // If using wallet, get signature
      if (walletAddress && !apiKey) {
        // Get challenge
        const { challenge } = await openApi.getChallenge(agentId);

        // Sign challenge with wallet
        const signature = await signChallenge(challenge);

        // Deregister with signature
        await openApi.deregisterAgent(agentId, {
          walletAddress,
          challenge,
          signature
        });
      } else {
        // Deregister with API key
        await openApi.deregisterAgent(agentId, apiKey!);
      }

      window.location.href = "/my-agents";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to deregister");
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-900 border border-red-900/50 rounded-lg p-5">
      <h4 className="text-sm font-semibold text-red-400 mb-2">Danger Zone</h4>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-300">Deregister Agent</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Remove this agent from the GT8004 platform.
          </p>
        </div>
        <button
          onClick={() => setShowConfirm(true)}
          className="px-4 py-1.5 rounded-md text-sm font-medium bg-red-900/30 text-red-400 hover:bg-red-900/50 transition-colors"
        >
          Deregister
        </button>
      </div>
      {error && <p className="text-sm text-red-400 mt-2">{error}</p>}

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-3">Deregister Agent</h3>
            <p className="text-sm text-gray-300 mb-2">
              Are you sure you want to deregister <span className="font-mono text-white">{agentId}</span>?
            </p>
            <div className="bg-red-950/30 border border-red-900/50 rounded-lg p-3 mb-5">
              <p className="text-xs text-red-400">
                This action will permanently delete all stored data including analytics, customer records, request logs, and revenue history. This cannot be undone.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={loading}
                className="px-4 py-2 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeregister}
                disabled={loading}
                className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {loading ? "Deregistering..." : "Yes, Deregister"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Settings ---------- */

interface SettingsTabProps {
  agent: Agent | null;
  id: string;
  apiKey: string | null;
  walletAddress: string | null;
  networkAgent: NetworkAgent | null;
  refreshAgent: () => Promise<void>;
}

function SettingsTab({
  agent,
  id,
  apiKey,
  walletAddress,
  networkAgent,
  refreshAgent,
}: SettingsTabProps) {
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [keyLoading, setKeyLoading] = useState(false);

  // Metadata editor state
  const [editingMetadata, setEditingMetadata] = useState(false);
  const [metadataValue, setMetadataValue] = useState("");
  const [metadataValidationError, setMetadataValidationError] = useState("");
  const [metadataSaving, setMetadataSaving] = useState(false);
  const [metadataTxStatus, setMetadataTxStatus] = useState<"idle" | "estimating" | "signing" | "confirming" | "syncing">("idle");
  const [metadataTxHash, setMetadataTxHash] = useState("");
  const [metadataError, setMetadataError] = useState("");

  // Success state
  const [showSuccess, setShowSuccess] = useState(false);
  const [submittedMetadata, setSubmittedMetadata] = useState<Record<string, unknown> | null>(null);

  // Refresh state
  const [metadataRefreshing, setMetadataRefreshing] = useState(false);

  const cleanError = (err: unknown, fallback: string): string => {
    const raw = err instanceof Error ? err.message : String(err);
    if (raw.includes("user rejected")) return "Transaction rejected by user.";
    if (raw.includes("Failed to fetch")) return "Failed to connect to the network. Please check your wallet RPC settings.";
    if (raw.length > 200) return raw.slice(0, 150) + "...";
    return raw || fallback;
  };

  const validateMetadataJSON = (value: string): boolean => {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed !== "object" || Array.isArray(parsed)) {
        setMetadataValidationError("Metadata must be a JSON object");
        return false;
      }
      if (parsed.services && !Array.isArray(parsed.services)) {
        setMetadataValidationError("'services' must be an array");
        return false;
      }
      if (Array.isArray(parsed.services)) {
        for (const svc of parsed.services) {
          if (!svc.name || !svc.endpoint) {
            setMetadataValidationError("Each service must have 'name' and 'endpoint' fields");
            return false;
          }
        }
      }
      setMetadataValidationError("");
      return true;
    } catch (err) {
      setMetadataValidationError(`Invalid JSON: ${(err as Error).message}`);
      return false;
    }
  };

  const handleMetadataSave = async () => {
    if (!agent || !walletAddress || !networkAgent) {
      setMetadataError("Missing required data. Ensure wallet is connected and agent is loaded.");
      return;
    }
    if (!agent.erc8004_token_id || !agent.chain_id) {
      setMetadataError("This agent is not registered on-chain.");
      return;
    }
    if (!validateMetadataJSON(metadataValue)) {
      return;
    }

    const parsedMetadata = JSON.parse(metadataValue);
    const newUri = encodeDataUri(parsedMetadata);

    setMetadataSaving(true);
    setMetadataError("");
    setMetadataTxHash("");

    try {
      setMetadataTxStatus("estimating");
      setMetadataTxStatus("signing");
      const hash = await updateAgentURI(agent.chain_id, agent.erc8004_token_id, newUri);

      setMetadataTxHash(hash);
      setMetadataTxStatus("confirming");

      // Wait for Discovery service to sync (5 seconds)
      setMetadataTxStatus("syncing");
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Refresh agent data
      await refreshAgent();

      // Show success state with submitted metadata
      setSubmittedMetadata(parsedMetadata);
      setEditingMetadata(false);
      setShowSuccess(true);
      setMetadataTxStatus("idle");
    } catch (err: unknown) {
      console.error("Metadata update failed:", err);
      setMetadataError(cleanError(err, "Failed to update metadata"));
      setMetadataTxStatus("idle");
    } finally {
      setMetadataSaving(false);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccess(false);
    setSubmittedMetadata(null);
    setMetadataTxHash("");
  };

  const handleMetadataRefresh = async () => {
    setMetadataRefreshing(true);
    try {
      await refreshAgent();
    } catch (err) {
      console.error("Failed to refresh agent:", err);
    } finally {
      setMetadataRefreshing(false);
    }
  };

  const handleRegenerateKey = async () => {
    const auth = apiKey || (walletAddress ? { walletAddress } : null);
    if (!auth) return;
    setKeyLoading(true);
    try {
      const res = await openApi.regenerateAPIKey(agent?.agent_id || id, auth);
      setGeneratedKey(res.api_key);
    } catch (err) {
      console.error("Failed to regenerate API key:", err);
    } finally {
      setKeyLoading(false);
    }
  };
  return (
    <div className="space-y-6">
      {/* API Key */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
        <h4 className="text-sm font-semibold text-gray-400 mb-4">API Key</h4>
        {(apiKey || generatedKey) ? (
          <>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm font-mono text-gray-300 bg-gray-950 px-3 py-2 rounded border border-gray-800 break-all">
                {generatedKey || apiKey}
              </code>
              <CopyButton text={generatedKey || apiKey || ""} />
            </div>
            <p className="text-xs text-gray-600 mt-2">
              Use this key to authenticate SDK and API requests.
            </p>
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-400">
              No API key in current session. Generate a new key to use with SDK and API.
            </p>
            <button
              onClick={handleRegenerateKey}
              disabled={keyLoading || (!apiKey && !walletAddress)}
              className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {keyLoading ? "Generating..." : "Generate API Key"}
            </button>
          </div>
        )}
      </div>

      {/* JSON Metadata Editor */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
        <h4 className="text-sm font-semibold text-gray-400 mb-4">Agent Metadata</h4>
        <p className="text-xs text-gray-500 mb-3">
          Edit your agent's JSON metadata. Changes are updated on-chain via ERC-8004 contract.
        </p>

        {!walletAddress ? (
          <p className="text-sm text-gray-500">
            Connect your wallet to view and edit agent metadata.
          </p>
        ) : !agent?.erc8004_token_id || !agent?.chain_id ? (
          <p className="text-sm text-gray-500">
            This agent is not registered on-chain. Only ERC-8004 registered agents can update metadata on-chain.
          </p>
        ) : !networkAgent?.metadata ? (
          <p className="text-sm text-gray-500">
            Loading metadata...
          </p>
        ) : showSuccess ? (
          <div className="space-y-4">
            {/* Success header with checkmark */}
            <div className="flex items-center gap-2 text-green-400">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <h4 className="text-base font-semibold">Metadata Updated Successfully!</h4>
            </div>

            {/* Submitted metadata preview */}
            {submittedMetadata && (
              <CodeBlock
                code={JSON.stringify(submittedMetadata, null, 2)}
                label="New Metadata (Submitted On-Chain)"
              />
            )}

            {/* Block explorer link */}
            {metadataTxHash && agent?.chain_id && (
              <a
                href={`${explorerUrl(agent.chain_id)}/tx/${metadataTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-400 hover:text-blue-300 underline inline-block"
              >
                View Transaction on Block Explorer →
              </a>
            )}

            {/* Info message */}
            <div className="p-3 rounded-lg bg-blue-900/20 border border-blue-800">
              <p className="text-sm text-gray-300">
                ℹ️ Changes have been submitted on-chain. Discovery service will sync shortly
                and your agent profile will be updated automatically.
              </p>
            </div>

            {/* Done button */}
            <button
              onClick={handleSuccessClose}
              className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
            >
              Done
            </button>
          </div>
        ) : !editingMetadata ? (
          <div className="space-y-3">
            <CodeBlock
              code={JSON.stringify(networkAgent.metadata, null, 2)}
              label="Current Metadata"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setEditingMetadata(true);
                  setMetadataValue(JSON.stringify(networkAgent.metadata, null, 2));
                }}
                className="px-3 py-2 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm transition-colors"
              >
                Edit Metadata
              </button>
              <button
                onClick={handleMetadataRefresh}
                disabled={metadataRefreshing}
                className="px-3 py-2 rounded-md bg-gray-800 hover:bg-gray-700 text-gray-400 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {metadataRefreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <textarea
              value={metadataValue}
              onChange={(e) => {
                setMetadataValue(e.target.value);
                validateMetadataJSON(e.target.value);
              }}
              className={`w-full h-96 px-3 py-2 bg-gray-950 border rounded-md text-sm font-mono text-gray-300 placeholder-gray-600 focus:outline-none transition-colors ${
                metadataValidationError ? 'border-red-500' : 'border-gray-700 focus:border-blue-500'
              }`}
              placeholder='{"name": "My Agent", "description": "...", "services": [...]}'
            />

            {metadataValidationError && (
              <div className="p-2 rounded bg-red-900/20 border border-red-800">
                <p className="text-xs text-red-400">{metadataValidationError}</p>
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={handleMetadataSave}
                disabled={metadataSaving || !metadataValue || !!metadataValidationError}
                className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {metadataSaving ? "Updating..." : "Update On-Chain"}
              </button>
              <button
                onClick={() => {
                  setEditingMetadata(false);
                  setMetadataValue("");
                  setMetadataValidationError("");
                  setMetadataError("");
                }}
                disabled={metadataSaving}
                className="px-3 py-2 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Transaction Status */}
        {metadataTxStatus !== "idle" && (
          <div className="mt-4 p-4 rounded-lg border border-blue-800 bg-blue-900/20">
            <div className="flex items-center gap-3">
              <svg className="animate-spin h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-400">
                  {metadataTxStatus === "estimating" && "Estimating gas..."}
                  {metadataTxStatus === "signing" && "Waiting for signature..."}
                  {metadataTxStatus === "confirming" && "Confirming transaction..."}
                  {metadataTxStatus === "syncing" && "Waiting for Discovery sync..."}
                </p>
                {metadataTxHash && agent?.chain_id && (
                  <a
                    href={`${explorerUrl(agent.chain_id)}/tx/${metadataTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 underline mt-1 inline-block"
                  >
                    View on Block Explorer →
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {metadataError && (
          <div className="mt-3 p-3 rounded-lg border border-red-800 bg-red-900/20">
            <p className="text-sm text-red-400">{metadataError}</p>
          </div>
        )}
      </div>

      {/* Danger Zone */}
      <DeregisterSection agentId={agent?.agent_id || id} apiKey={apiKey} walletAddress={walletAddress} />
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

/** Parse agentURI (data: URI or raw JSON) into metadata object. */
function parseAgentURI(uri: string | undefined | null): AgentMetadata | null {
  if (!uri) return null;
  let json: string | null = null;
  if (uri.startsWith("data:application/json;base64,")) {
    try { json = atob(uri.slice("data:application/json;base64,".length)); } catch { return null; }
  } else if (uri.startsWith("data:application/json,")) {
    json = uri.slice("data:application/json,".length);
  } else if (uri.startsWith("{")) {
    json = uri;
  }
  if (!json) return null;
  try { return JSON.parse(json) as AgentMetadata; } catch { return null; }
}

function OverviewTab({ agent, networkAgent, id }: OverviewTabProps) {
  // Try networkAgent metadata first, fallback to parsing agent's own agentURI
  const meta = networkAgent?.metadata || parseAgentURI(agent?.agent_uri || networkAgent?.agent_uri);
  const imageUrl = resolveImageUrl(meta?.image ?? networkAgent?.image_url ?? null);
  const description = meta?.description ?? networkAgent?.description;
  const metaServices: AgentService[] = useMemo(() => {
    const list = (meta?.services ?? meta?.endpoints ?? [])
      .filter((s: AgentService) => s.name !== "OASF");
    // If no services array but metadata has a url, derive a service entry from it
    if (list.length === 0 && meta?.url) {
      const url = meta.url as string;
      const name = meta?.type === "MCP" ? "MCP" : meta?.type === "A2A" ? "A2A" : "Web";
      return [{ name, endpoint: url }];
    }
    return list;
  }, [meta]);

  // Build service list from on-chain metadata only
  const services: AgentService[] = useMemo(() => {
    return metaServices.filter((s) => {
      const endpoint = s.endpoint.toLowerCase();
      return !endpoint.includes('/gateway/') && !endpoint.includes('/v1/agents/');
    });
  }, [metaServices]);
  const hasX402 = meta?.x402Support || meta?.x402support || false;

  const explorer = networkAgent ? explorerUrl(networkAgent.chain_id) : null;
  const network = networkAgent ? NETWORKS[Object.keys(NETWORKS).find((k) => NETWORKS[k].chainId === networkAgent.chain_id) || ""] : null;
  const truncAddr = (addr: string) => addr.length > 12 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr;

  // Health check
  const [healthStatus, setHealthStatus] = useState<Record<string, { status: "checking" | "healthy" | "unhealthy" }>>({});
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const runHealthChecks = useCallback(() => {
    const withEndpoints = services.filter((s) => s.endpoint);
    if (withEndpoints.length === 0) return;

    const init: Record<string, { status: "checking" }> = {};
    for (const svc of withEndpoints) init[svc.endpoint] = { status: "checking" };
    setHealthStatus(init);
    setLastChecked(new Date());

    for (const svc of withEndpoints) {
      const url = svc.endpoint;
      // Proxy all health checks through backend to avoid CORS
      const healthUrl = svc.name === "Origin"
        ? `${BACKEND_URL}/v1/agents/${id}/origin-health`
        : `${BACKEND_URL}/v1/proxy/health?endpoint=${encodeURIComponent(url)}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      fetch(healthUrl, { method: "GET", signal: controller.signal })
        .then(async (res) => {
          clearTimeout(timeout);
          const data = await res.json().catch(() => ({}));
          return data.status === "healthy" ? "healthy" : "unhealthy";
        })
        .then((status: "healthy" | "unhealthy") => {
          setHealthStatus((prev) => ({ ...prev, [url]: { status } }));
        })
        .catch(() => {
          clearTimeout(timeout);
          setHealthStatus((prev) => ({ ...prev, [url]: { status: "unhealthy" } }));
        });
    }
  }, [services]);

  useEffect(() => { runHealthChecks(); }, [runHealthChecks]);

  return (
    <div className="space-y-6">
      {/* Agent Profile + Stats */}
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
        {agent && (
          <>
            <div className="border-t border-gray-800 my-4" />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <StatCard label="Total Requests" value={agent.total_requests?.toLocaleString() ?? "0"} />
              <StatCard label="Total Revenue" value={`$${(agent.total_revenue_usdc ?? 0).toFixed(2)}`} />
              <StatCard label="Avg Response" value={`${(agent.avg_response_ms ?? 0).toFixed(0)}ms`} />
            </div>
          </>
        )}
      </div>

      {/* On-chain Identity */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
        <h4 className="text-sm font-semibold text-gray-400 mb-4">On-chain Identity</h4>

        <div className="grid grid-cols-2 gap-x-8">
          {/* Contract State — left column */}
          <div>
            <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider mb-2">Contract State</p>
            <div className="space-y-2">
              {(agent?.erc8004_token_id != null || networkAgent?.token_id != null) && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Token ID</span>
                  <span className="text-xs font-mono text-gray-300">#{agent?.erc8004_token_id ?? networkAgent?.token_id}</span>
                </div>
              )}
              {networkAgent && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Chain</span>
                  <span className="text-xs text-gray-300">{chainName(networkAgent.chain_id)}</span>
                </div>
              )}
              {(agent?.evm_address || networkAgent?.owner_address) && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Owner</span>
                  {explorer ? (
                    <a href={`${explorer}/address/${agent?.evm_address || networkAgent?.owner_address}`} target="_blank" rel="noopener noreferrer" className="text-xs font-mono text-blue-400 hover:text-blue-300">
                      {truncAddr(agent?.evm_address || networkAgent?.owner_address || "")}
                    </a>
                  ) : (
                    <span className="text-xs font-mono text-gray-300">{truncAddr(agent?.evm_address || networkAgent?.owner_address || "")}</span>
                  )}
                </div>
              )}
              {networkAgent?.creator_address && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Creator</span>
                  {explorer ? (
                    <a href={`${explorer}/address/${networkAgent.creator_address}`} target="_blank" rel="noopener noreferrer" className="text-xs font-mono text-blue-400 hover:text-blue-300">
                      {truncAddr(networkAgent.creator_address)}
                    </a>
                  ) : (
                    <span className="text-xs font-mono text-gray-300">{truncAddr(networkAgent.creator_address)}</span>
                  )}
                </div>
              )}
              {networkAgent?.created_tx && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Created TX</span>
                  {explorer ? (
                    <a href={`${explorer}/tx/${networkAgent.created_tx}`} target="_blank" rel="noopener noreferrer" className="text-xs font-mono text-blue-400 hover:text-blue-300">
                      {truncAddr(networkAgent.created_tx)}
                    </a>
                  ) : (
                    <span className="text-xs font-mono text-gray-300">{truncAddr(networkAgent.created_tx)}</span>
                  )}
                </div>
              )}
              {network && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Registry</span>
                  {explorer ? (
                    <a href={`${explorer}/address/${network.contractAddress}`} target="_blank" rel="noopener noreferrer" className="text-xs font-mono text-blue-400 hover:text-blue-300">
                      {truncAddr(network.contractAddress)}
                    </a>
                  ) : (
                    <span className="text-xs font-mono text-gray-300">-</span>
                  )}
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 flex items-center gap-1.5">
                  Agent Wallet <Badge label="X402" variant="low" />
                </span>
                {hasX402 && (agent?.evm_address || networkAgent?.owner_address) ? (
                  explorer ? (
                    <a href={`${explorer}/address/${agent?.evm_address || networkAgent?.owner_address}`} target="_blank" rel="noopener noreferrer" className="text-xs font-mono text-blue-400 hover:text-blue-300">
                      {truncAddr(agent?.evm_address || networkAgent?.owner_address || "")}
                    </a>
                  ) : (
                    <span className="text-xs font-mono text-gray-300">{truncAddr(agent?.evm_address || networkAgent?.owner_address || "")}</span>
                  )
                ) : (
                  <span className="text-xs text-gray-500">-</span>
                )}
              </div>
            </div>
          </div>

          {/* Metadata & Timestamps — right column */}
          <div>
            <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider mb-2">On-chain Metadata</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Name</span>
                <span className="text-xs text-gray-300">{networkAgent?.name || agent?.name || "-"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">X-402 Support</span>
                <span className={`text-xs font-medium ${hasX402 ? "text-green-400" : "text-gray-500"}`}>
                  {hasX402 ? "Supported" : "Not Supported"}
                </span>
              </div>
              {(agent?.agent_uri || networkAgent?.agent_uri) && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Agent URI</span>
                  <div className="flex items-center gap-1.5 max-w-[60%]">
                    <span className="text-xs font-mono text-gray-300 truncate">
                      {(agent?.agent_uri || networkAgent?.agent_uri || "").length > 30
                        ? (agent?.agent_uri || networkAgent?.agent_uri || "").slice(0, 30) + "..."
                        : (agent?.agent_uri || networkAgent?.agent_uri || "")}
                    </span>
                    <CopyButton text={agent?.agent_uri || networkAgent?.agent_uri || ""} />
                  </div>
                </div>
              )}
            </div>
            <div className="border-t border-gray-800 my-3" />
            <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider mb-2">Timestamps</p>
            <div className="space-y-2">
              {(agent?.created_at || networkAgent?.created_at) && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Created</span>
                  <span className="text-xs text-gray-300">{new Date(agent?.created_at || networkAgent?.created_at || "").toLocaleDateString()}</span>
                </div>
              )}
              {networkAgent?.synced_at && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Last Synced</span>
                  <span className="text-xs text-gray-300">{new Date(networkAgent.synced_at).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Services / Endpoints with Health Check */}
      {services.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-gray-400">Services</h4>
            <div className="flex items-center gap-3">
              {lastChecked && (
                <span className="text-[10px] text-gray-600">
                  Checked {lastChecked.toLocaleTimeString()}
                </span>
              )}
              <button
                onClick={runHealthChecks}
                className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
              >
                Refresh
              </button>
            </div>
          </div>
          <div className="space-y-3">
            {services.map((svc, i) => {
              const health = svc.endpoint ? healthStatus[svc.endpoint] : undefined;
              return (
                <div key={i} className="p-3 bg-gray-950 rounded-lg border border-gray-800">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{svc.name}</span>
                      {svc.version && <span className="text-xs text-gray-500">v{svc.version}</span>}
                      {(svc.name === "A2A" || svc.name === "Origin") && (
                        agent?.sdk_connected_at ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-emerald-900/30 text-emerald-400 border border-emerald-800/50">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            SDK
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-gray-800/50 text-gray-500 border border-gray-700/50">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-600" />
                            SDK
                          </span>
                        )
                      )}
                    </div>
                    {health && (
                      <div className="flex items-center gap-1.5">
                        {health.status === "checking" ? (
                          <span className="flex items-center gap-1 text-[10px] text-gray-500">
                            <span className="w-2 h-2 rounded-full bg-gray-500 animate-pulse" />
                            Checking...
                          </span>
                        ) : health.status === "healthy" ? (
                          <span className="flex items-center gap-1 text-[10px] text-green-400">
                            <span className="w-2 h-2 rounded-full bg-green-400" />
                            Healthy
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] text-red-400">
                            <span className="w-2 h-2 rounded-full bg-red-400" />
                            Unhealthy
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="text-xs font-mono text-gray-400 break-all">{svc.endpoint}</p>
                  {(svc.skills?.length || svc.domains?.length) && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {svc.skills?.map((s: string) => (
                        <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-purple-900/30 text-purple-400">{s}</span>
                      ))}
                      {svc.domains?.map((d: string) => (
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
              );
            })}
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
  "sdk-http": "#6B7280",
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
      if (d.source === "gateway") continue;
      allKeys.add(protoKey(d.source, d.protocol));
    }
  }
  const sortedKeys = Array.from(allKeys).sort();

  // Build stacked daily chart data from source×protocol breakdown
  const dailyProtoChart = (() => {
    if (!analytics?.daily_by_protocol?.length) return null;
    const byDate: Record<string, Record<string, number> & { date: string; label: string }> = {};
    for (const d of analytics.daily_by_protocol) {
      if (d.source === "gateway") continue;
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
  const proto = analytics?.protocol?.filter((p) => p.source !== "gateway");
  const tools = analytics?.tool_ranking;
  const cust = analytics?.customers;
  const mcpTools = analytics?.mcp_tools;

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

      {/* Row 4: Tool Ranking */}
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

      {/* Row 6: A2A Endpoints + Top Callers (horizontal) */}
      {((a2aEndpoints && a2aEndpoints.length > 0) || (cust && cust.top_callers.length > 0)) && (
        <div className="grid grid-cols-2 gap-4">
          {/* A2A Endpoints */}
          {a2aEndpoints && a2aEndpoints.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
              <h3 className="text-sm font-medium text-gray-400 mb-4">A2A Endpoints</h3>
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
                      <td className="py-2 text-white font-mono truncate max-w-[100px]">{e.endpoint}</td>
                      <td className="py-2 text-right text-gray-300 font-mono">{e.call_count.toLocaleString()}</td>
                      <td className="py-2 text-right text-gray-400 font-mono">{e.avg_response_ms.toFixed(0)}ms</td>
                      <td className={`py-2 text-right font-mono ${e.error_rate > 0.05 ? "text-red-400" : "text-green-400"}`}>
                        {(e.error_rate * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Top Callers */}
          {cust && cust.top_callers.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
              <h3 className="text-sm font-medium text-gray-400 mb-4">Top Callers</h3>
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
                      <td className="py-2 text-white font-mono truncate max-w-[100px]">{tc.customer_id}</td>
                      <td className="py-2 text-right text-gray-300 font-mono">{tc.request_count.toLocaleString()}</td>
                      <td className="py-2 text-right text-emerald-400 font-mono">${tc.revenue.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Row 7: Health Monitoring */}
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
    p75_response_ms?: number;
    p90_response_ms?: number;
    p95_response_ms: number;
    p99_response_ms: number;
    avg_response_ms: number;
    error_rate: number;
    total_requests: number;
    success_requests: number;
    error_requests: number;
    requests_per_min: number;
    uptime: number;
    health_score?: number;
    health_status?: string;
    health_delta?: number;
    p95_delta_ms?: number;
    error_delta?: number;
    throughput_delta?: number;
    uptime_delta?: number;
    p95_trend?: number[];
    error_rate_trend?: number[];
    throughput_trend?: number[];
    uptime_trend?: number[];
  } | null;
  analytics?: AnalyticsReport | null;
  dailyStats?: { stats: DailyStats[] } | null;
}

function SpeedInsightsTab({ performance, analytics, dailyStats }: SpeedInsightsTabProps) {
  if (!performance) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center">
        <p className="text-gray-500 text-sm">No performance data yet. Start sending requests to see speed insights.</p>
      </div>
    );
  }

  // Prepare latency distribution data (with P75 and P90 if available)
  const latencyData = [
    { label: "P50", value: performance.p50_response_ms },
    ...(performance.p75_response_ms ? [{ label: "P75", value: performance.p75_response_ms }] : []),
    ...(performance.p90_response_ms ? [{ label: "P90", value: performance.p90_response_ms }] : []),
    { label: "P95", value: performance.p95_response_ms },
    { label: "P99", value: performance.p99_response_ms },
  ];

  return (
    <div className="space-y-6">
      {/* Health Score (if available) */}
      {performance.health_score !== undefined && performance.health_status && (
        <HealthScoreCard
          score={performance.health_score}
          status={performance.health_status}
          delta={performance.health_delta || 0}
        />
      )}

      {/* Performance Vital Signs with Trends */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCardWithTrend
          label="P95 Latency"
          value={`${performance.p95_response_ms.toFixed(0)}ms`}
          delta={performance.p95_delta_ms}
          trend={performance.p95_trend}
        />
        <StatCardWithTrend
          label="Error Rate"
          value={`${(performance.error_rate * 100).toFixed(1)}%`}
          delta={performance.error_delta ? performance.error_delta * 100 : undefined}
          trend={performance.error_rate_trend?.map((r) => r * 100)}
          colorThreshold={{ good: 0.02, warn: 0.05 }}
        />
        <StatCardWithTrend
          label="Throughput"
          value={`${performance.requests_per_min.toFixed(1)} rpm`}
          delta={performance.throughput_delta}
          trend={performance.throughput_trend}
        />
        <StatCardWithTrend
          label="Uptime"
          value={`${performance.uptime.toFixed(2)}%`}
          delta={performance.uptime_delta}
          trend={performance.uptime_trend}
          colorThreshold={{ good: 99, warn: 95 }}
        />
      </div>

      {/* Enhanced Latency Distribution */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
        <h3 className="text-sm font-medium text-gray-400 mb-4">Response Time Distribution (24h)</h3>
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
        <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-500">
          <span>P50: {performance.p50_response_ms.toFixed(0)}ms</span>
          {performance.p75_response_ms && <span>P75: {performance.p75_response_ms.toFixed(0)}ms</span>}
          {performance.p90_response_ms && <span>P90: {performance.p90_response_ms.toFixed(0)}ms</span>}
          <span>P95: {performance.p95_response_ms.toFixed(0)}ms</span>
          <span>P99: {performance.p99_response_ms.toFixed(0)}ms</span>
        </div>
      </div>

      {/* Protocol & Tool Breakdown */}
      {analytics && (
        <div className="space-y-4">
          <ProtocolBreakdownCards protocols={analytics.protocol || []} />
          <ToolPerformanceTable tools={analytics.tool_ranking || []} />
        </div>
      )}

      {/* 7-Day Trend Chart */}
      {dailyStats && dailyStats.stats && dailyStats.stats.length > 0 && (
        <TrendChart data={dailyStats.stats} />
      )}

      {/* Success / Error breakdown (keep as fallback) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            {performance.p75_response_ms && <MetricRow label="P75" value={`${performance.p75_response_ms.toFixed(0)}ms`} />}
            {performance.p90_response_ms && <MetricRow label="P90" value={`${performance.p90_response_ms.toFixed(0)}ms`} />}
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
                value={`${performance.uptime.toFixed(2)}%`}
                color={performance.uptime >= 99 ? "text-green-400" : "text-yellow-400"}
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
  newThisWeek: number;
  returningThisWeek: number;
}

function CustomersTab({ agentId, customers, totalCustomers, newThisWeek, returningThisWeek }: CustomersTabProps) {
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
      <div className="grid grid-cols-6 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">Total Customers</p>
          <p className="text-2xl font-bold">{totalCustomers}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">New This Week</p>
          <p className="text-2xl font-bold text-blue-400">{newThisWeek}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">Returning This Week</p>
          <p className="text-2xl font-bold text-purple-400">{returningThisWeek}</p>
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