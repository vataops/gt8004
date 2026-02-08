"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { StatCard } from "@/components/StatCard";
import { openApi, Agent, fetchScanAgents } from "@/lib/api";
import { NETWORK_LIST } from "@/lib/networks";

interface AgentRow {
  agent_id: string;
  name: string;
  token_id: number | null;
  chain: string;
  chain_id: number;
  score: number;
  feedback: number;
  status: string;
  created_at: string;
  agent_uri: string;
  registered: boolean;
}

export default function MyAgentsPage() {
  const { walletAddress, loading: authLoading } = useAuth();
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
  const totalFeedback = agents.reduce((sum, a) => sum + a.feedback, 0);
  const avgScore =
    agents.length > 0
      ? agents.reduce((sum, a) => sum + a.score, 0) / agents.length
      : 0;

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
        <Link
          href="/register"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-sm font-medium transition-colors"
        >
          Create Agent
        </Link>
      </div>

      {/* Wallet address */}
      {walletAddress && (
        <p className="text-xs text-gray-500 mb-4 font-mono">
          {walletAddress}
        </p>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Agents" value={totalAgents} />
        <StatCard label="Total Feedback" value={totalFeedback} />
        <StatCard
          label="Average Score"
          value={avgScore > 0 ? avgScore.toFixed(1) : "0"}
        />
      </div>

      {/* Agent Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-500">
              <th className="text-left p-3">Agent</th>
              <th className="text-left p-3">Chain</th>
              <th className="text-left p-3">Score</th>
              <th className="text-left p-3">Feedback</th>
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
                  colSpan={7}
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
