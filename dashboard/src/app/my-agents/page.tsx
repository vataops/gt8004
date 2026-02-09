"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { StatCard } from "@/components/StatCard";
import { openApi, Agent, fetchScanAgents } from "@/lib/api";
import { NETWORK_LIST } from "@/lib/networks";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const AGENT_COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#ec4899"];

interface AgentRow {
  agent_id: string;
  name: string;
  token_id: number | null;
  chain: string;
  chain_id: number;
  score: number;
  feedback: number;
  total_requests: number;
  total_customers: number;
  total_revenue: number;
  status: string;
  created_at: string;
  agent_uri: string;
  registered: boolean;
}

export default function MyAgentsPage() {
  const { walletAddress, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !walletAddress) {
      router.replace("/login");
    }
  }, [authLoading, walletAddress, router]);

  const loadAgents = useCallback(async () => {
    if (!walletAddress) {
      setLoading(false);
      return;
    }

    try {
      // Fetch platform agents and on-chain tokens in parallel
      const [platformResult, ...tokenResults] = await Promise.allSettled([
        openApi.getWalletAgents(walletAddress),
        ...NETWORK_LIST.map((n) =>
          openApi.listTokensByOwner(walletAddress, n.chainId).then((r) => ({
            network: n,
            tokens: r.tokens || [],
          }))
        ),
      ]);

      const platformAgents: Agent[] =
        platformResult.status === "fulfilled"
          ? platformResult.value.agents || []
          : [];

      // Collect all on-chain tokens for 8004scan lookup
      const allTokens: { token_id: number; chain_id: number; network: typeof NETWORK_LIST[number]; agent_uri: string }[] = [];
      const seenTokenIds = new Set<string>();

      for (const result of tokenResults) {
        if (result.status !== "fulfilled") continue;
        const { network, tokens } = result.value;
        for (const token of tokens) {
          const key = `${network.chainId}-${token.token_id}`;
          if (seenTokenIds.has(key)) continue;
          seenTokenIds.add(key);
          allTokens.push({ token_id: token.token_id, chain_id: network.chainId, network, agent_uri: token.agent_uri || "" });
        }
      }

      // Fetch metadata from 8004scan for all tokens
      const scanData = await fetchScanAgents(
        allTokens.map((t) => ({ token_id: t.token_id, chain_id: t.chain_id }))
      );

      // Build agent rows from on-chain tokens
      const rows: AgentRow[] = [];

      for (const token of allTokens) {
        const key = `${token.chain_id}-${token.token_id}`;
        const scanAgent = scanData.get(key);

        // Match with platform agent by token_id
        const platformAgent = platformAgents.find(
          (a) => a.erc8004_token_id === token.token_id
        );

        // Name priority: 8004scan > platform agent > fallback
        const name = scanAgent?.name || platformAgent?.name || `Token #${token.token_id}`;
        const score = scanAgent?.total_score ?? platformAgent?.reputation_score ?? 0;

        rows.push({
          agent_id: platformAgent?.agent_id || `token-${token.token_id}`,
          name,
          token_id: token.token_id,
          chain: token.network.shortName,
          chain_id: token.chain_id,
          score,
          feedback: scanAgent?.total_feedbacks ?? 0,
          total_requests: platformAgent?.total_requests ?? 0,
          total_customers: platformAgent?.total_customers ?? 0,
          total_revenue: platformAgent?.total_revenue_usdc ?? 0,
          status: scanAgent ? (scanAgent.is_active ? "active" : "inactive") : (platformAgent?.status || "active"),
          created_at: scanAgent?.created_at || platformAgent?.created_at || "",
          agent_uri: token.agent_uri,
          registered: !!platformAgent,
        });
      }

      // Add platform agents that don't have on-chain tokens
      for (const agent of platformAgents) {
        const hasToken = rows.some(
          (r) => r.agent_id === agent.agent_id
        );
        if (!hasToken) {
          rows.push({
            agent_id: agent.agent_id,
            name: agent.name || agent.agent_id,
            token_id: agent.erc8004_token_id ?? null,
            chain: "-",
            chain_id: 0,
            score: agent.reputation_score ?? 0,
            feedback: 0,
            total_requests: agent.total_requests ?? 0,
            total_customers: agent.total_customers ?? 0,
            total_revenue: agent.total_revenue_usdc ?? 0,
            status: agent.status,
            created_at: agent.created_at,
            agent_uri: "",
            registered: true,
          });
        }
      }

      setAgents(rows);
    } catch (err) {
      console.error("Failed to load agents:", err);
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  const totalAgents = agents.length;
  const totalRequests = agents.reduce((sum, a) => sum + a.total_requests, 0);
  const totalRevenue = agents.reduce((sum, a) => sum + a.total_revenue, 0);
  const totalFeedback = agents.reduce((sum, a) => sum + a.feedback, 0);
  const avgScore =
    agents.length > 0
      ? agents.reduce((sum, a) => sum + a.score, 0) / agents.length
      : 0;

  // Chart data: each agent as a segment in the stacked bar
  const chartAgents = agents.map((a, i) => ({
    key: `a${i}`,
    label:
      a.token_id !== null && !a.name.startsWith("Token #")
        ? `${a.name} #${a.token_id}`
        : a.name,
    requests: a.total_requests,
    revenue: a.total_revenue,
    color: AGENT_COLORS[i % AGENT_COLORS.length],
  }));
  const requestBarData = [
    { _: "req", ...Object.fromEntries(chartAgents.map((a) => [a.key, a.requests])) },
  ];
  const revenueBarData = [
    { _: "rev", ...Object.fromEntries(chartAgents.map((a) => [a.key, a.revenue])) },
  ];

  if (authLoading || loading) {
    return <p className="text-gray-500">Loading agents...</p>;
  }

  if (!walletAddress) {
    return null;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold">My Agents</h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage your agents registered on the ERC-8004 registry
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={logout}
            className="px-4 py-2 rounded-md text-sm font-medium text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 transition-colors"
          >
            Disconnect
          </button>
          <Link
            href="/register"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-sm font-medium transition-colors"
          >
            Create Agent
          </Link>
        </div>
      </div>

      {/* Wallet address */}
      {walletAddress && (
        <p className="text-xs text-gray-500 mb-4 font-mono">
          {walletAddress}
        </p>
      )}

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <StatCard label="Total Agents" value={totalAgents} />
        <StatCard label="Total Requests" value={totalRequests.toLocaleString()} />
        <StatCard label="Total Revenue" value={`$${totalRevenue.toFixed(2)}`} sub="USDC" />
        <StatCard label="Total Feedback" value={totalFeedback} />
        <StatCard
          label="Average Score"
          value={avgScore > 0 ? avgScore.toFixed(1) : "0"}
        />
      </div>

      {/* Breakdown Charts */}
      {agents.length > 0 && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <BreakdownChart
            title="Requests by Agent"
            data={requestBarData}
            agents={chartAgents}
            total={totalRequests}
            formatValue={(v) => v.toLocaleString()}
          />
          <BreakdownChart
            title="Revenue by Agent"
            data={revenueBarData}
            agents={chartAgents}
            total={totalRevenue}
            formatValue={(v) => `$${v.toFixed(2)}`}
          />
        </div>
      )}

      {/* Agent Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-500">
              <th className="text-left p-3">Agent</th>
              <th className="text-left p-3">Chain</th>
              <th className="text-left p-3">Score</th>
              <th className="text-left p-3">Feedback</th>
              <th className="text-left p-3">Requests</th>
              <th className="text-left p-3">Customers</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Created</th>
              <th className="text-left p-3"></th>
            </tr>
          </thead>
          <tbody>
            {agents.map((agent) => (
              <tr
                key={`${agent.chain_id}-${agent.agent_id}`}
                className="border-b border-gray-800/50 hover:bg-gray-800/30"
              >
                {/* Agent name + token */}
                <td className="p-3">
                  <div>
                    <span className="font-medium text-gray-100">
                      {agent.name}
                    </span>
                    {agent.token_id !== null &&
                      !agent.name.startsWith("Token #") && (
                        <span className="text-gray-500 ml-1.5">
                          #{agent.token_id}
                        </span>
                      )}
                  </div>
                  {agent.agent_uri && (
                    <p className="text-xs text-gray-600 truncate max-w-[250px] mt-0.5">
                      {agent.agent_uri}
                    </p>
                  )}
                </td>

                {/* Chain badge */}
                <td className="p-3">
                  <ChainBadge chain={agent.chain} chainId={agent.chain_id} />
                </td>

                {/* Score */}
                <td className="p-3 text-gray-300">
                  {agent.score > 0 ? agent.score.toFixed(1) : "—"}
                </td>

                {/* Feedback */}
                <td className="p-3 text-gray-300">{agent.feedback}</td>

                {/* Requests */}
                <td className="p-3 text-gray-300">{agent.total_requests.toLocaleString()}</td>

                {/* Customers */}
                <td className="p-3 text-gray-300">{agent.total_customers.toLocaleString()}</td>

                {/* Status */}
                <td className="p-3">
                  <StatusBadge status={agent.status} />
                </td>

                {/* Created */}
                <td className="p-3 text-gray-400 text-xs">
                  {agent.created_at
                    ? new Date(agent.created_at).toLocaleDateString()
                    : "—"}
                </td>

                {/* Actions */}
                <td className="p-3">
                  {agent.registered ? (
                    <Link
                      href={`/agents/${agent.agent_id}`}
                      className="text-blue-400 hover:text-blue-300 text-xs transition-colors"
                    >
                      View
                    </Link>
                  ) : (
                    <Link
                      href={`/register?token_id=${agent.token_id}&chain_id=${agent.chain_id}&agent_uri=${encodeURIComponent(agent.agent_uri || "")}`}
                      className="text-green-400 hover:text-green-300 text-xs transition-colors"
                    >
                      Register
                    </Link>
                  )}
                </td>
              </tr>
            ))}
            {agents.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="p-6 text-center text-gray-600"
                >
                  No agents found. Connect your wallet or register a new agent.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ChainBadge({
  chain,
  chainId,
}: {
  chain: string;
  chainId: number;
}) {
  // Color by chain
  const isBase = chainId === 84532 || chain.toLowerCase().includes("base");
  const bgColor = isBase ? "bg-blue-900/30" : "bg-purple-900/30";
  const textColor = isBase ? "text-blue-400" : "text-purple-400";

  if (chain === "-") return <span className="text-gray-600">—</span>;

  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${bgColor} ${textColor}`}
    >
      {chain}
    </span>
  );
}

interface ChartAgent {
  key: string;
  label: string;
  color: string;
}

function BreakdownChart({
  title,
  data,
  agents,
  total,
  formatValue,
}: {
  title: string;
  data: Record<string, unknown>[];
  agents: ChartAgent[];
  total: number;
  formatValue: (v: number) => string;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-400">{title}</h3>
        <span className="text-sm text-gray-300 font-medium">
          {formatValue(total)}
        </span>
      </div>
      {total > 0 ? (
        <div className="rounded-md overflow-hidden">
          <ResponsiveContainer width="100%" height={32}>
            <BarChart
              layout="vertical"
              data={data}
              margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
            >
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="_" hide />
              <Tooltip
                cursor={false}
                content={({ payload }) => {
                  if (!payload?.length) return null;
                  const items = payload.filter(
                    (p) => typeof p.value === "number" && p.value > 0
                  );
                  if (!items.length) return null;
                  return (
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-xs shadow-lg">
                      {items.map((p) => {
                        const agent = agents.find((a) => a.key === p.dataKey);
                        const val = p.value as number;
                        const pct =
                          total > 0 ? ((val / total) * 100).toFixed(1) : "0";
                        return (
                          <div
                            key={String(p.dataKey)}
                            className="flex items-center gap-2 py-0.5"
                          >
                            <div
                              className="w-2.5 h-2.5 rounded-sm shrink-0"
                              style={{ backgroundColor: agent?.color }}
                            />
                            <span className="text-gray-300">
                              {agent?.label}
                            </span>
                            <span className="text-gray-500 ml-auto pl-3">
                              {formatValue(val)} ({pct}%)
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                }}
              />
              {agents.map((a) => (
                <Bar
                  key={a.key}
                  dataKey={a.key}
                  stackId="stack"
                  fill={a.color}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-8 bg-gray-800/50 rounded flex items-center justify-center">
          <span className="text-xs text-gray-600">No data</span>
        </div>
      )}
      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
        {agents.map((a) => {
          const val = (data[0]?.[a.key] as number) || 0;
          return (
            <div key={a.key} className="flex items-center gap-1.5 text-xs">
              <div
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: a.color }}
              />
              <span className="text-gray-400">{a.label}</span>
              <span className="text-gray-600">{formatValue(val)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "bg-green-900/30 text-green-400",
    inactive: "bg-gray-800 text-gray-400",
    deregistered: "bg-red-900/30 text-red-400",
  };

  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
        colors[status] || colors.inactive
      }`}
    >
      {status}
    </span>
  );
}
