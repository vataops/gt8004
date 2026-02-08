"use client";

import Link from "next/link";
import { useLiteAgents } from "@/lib/hooks";

export default function AgentsPage() {
  const { data, loading } = useLiteAgents();

  if (loading) return <p className="text-gray-500">Loading...</p>;

  const agents = data?.agents || [];

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Agents</h2>
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-500">
              <th className="text-left p-3">Agent ID</th>
              <th className="text-left p-3">EVM Address</th>
              <th className="text-right p-3">Reputation</th>
              <th className="text-left p-3">Verified</th>
              <th className="text-left p-3">Registered</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((agent) => (
              <tr
                key={agent.id}
                className="border-b border-gray-800/50 hover:bg-gray-800/30"
              >
                <td className="p-3 font-mono text-xs">
                  <Link
                    href={`/agents/${agent.agent_id}`}
                    className="text-blue-400 hover:underline"
                  >
                    {agent.agent_id}
                  </Link>
                </td>
                <td className="p-3 font-mono text-xs text-gray-400">
                  {agent.evm_address || "-"}
                </td>
                <td className="p-3 text-right">
                  {agent.reputation_score != null
                    ? agent.reputation_score.toFixed(1)
                    : "-"}
                </td>
                <td className="p-3 text-gray-400 text-xs">
                  {agent.verified_at
                    ? new Date(agent.verified_at).toLocaleDateString()
                    : "Not verified"}
                </td>
                <td className="p-3 text-gray-500 text-xs">
                  {new Date(agent.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {agents.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-gray-600">
                  No agents registered yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
