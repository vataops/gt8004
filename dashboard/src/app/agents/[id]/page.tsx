"use client";

import { useParams } from "next/navigation";
import { useLiteAgent } from "@/lib/hooks";

export default function AgentDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { data: agent, loading } = useLiteAgent(id);

  if (loading) return <p className="text-gray-500">Loading...</p>;
  if (!agent) return <p className="text-red-400">Agent not found</p>;

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">
        Agent{" "}
        <span className="font-mono text-blue-400">{agent.agent_id}</span>
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500">EVM Address</p>
          <p className="text-sm font-mono mt-1 break-all">
            {agent.evm_address || "-"}
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500">Reputation</p>
          <p className="text-lg font-bold mt-1">
            {agent.reputation_score != null
              ? agent.reputation_score.toFixed(1)
              : "-"}
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500">Verified</p>
          <p className="text-sm mt-1">
            {agent.verified_at
              ? new Date(agent.verified_at).toLocaleDateString()
              : "Not verified"}
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500">Registered</p>
          <p className="text-sm mt-1">
            {new Date(agent.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  );
}
