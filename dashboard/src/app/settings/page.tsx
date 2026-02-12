"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { RequireAuth } from "@/components/RequireAuth";
import { StatCard } from "@/components/StatCard";
import { Badge } from "@/components/Badge";
import { CodeBlock } from "@/components/CodeBlock";
import { CopyButton } from "@/components/CopyButton";
import { openApi } from "@/lib/api";
import { hasWallet, connectWallet, signChallenge } from "@/lib/wallet";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_OPEN_API_URL || "http://localhost:8080";

export default function SettingsPage() {
  return (
    <RequireAuth>
      <SettingsContent />
    </RequireAuth>
  );
}

function SettingsContent() {
  const { agent, apiKey, login } = useAuth();
  const [verifyStatus, setVerifyStatus] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [editingEndpoint, setEditingEndpoint] = useState(false);
  const [endpointValue, setEndpointValue] = useState("");
  const [endpointSaving, setEndpointSaving] = useState(false);

  if (!agent || !apiKey) return null;

  const handleVerify = async () => {
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

  const handleEndpointSave = async () => {
    setEndpointSaving(true);
    try {
      await openApi.updateOriginEndpoint(agent.agent_id, endpointValue, apiKey);
      await login(apiKey);
      setEditingEndpoint(false);
    } catch (err) {
      console.error("Failed to update endpoint:", err);
    } finally {
      setEndpointSaving(false);
    }
  };

  const ingestExample = `curl -X POST ${BACKEND_URL}/v1/ingest \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "agent_id": "${agent.agent_id}",
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
    <div className="space-y-8">
      <h2 className="text-xl font-bold">Settings</h2>

      {/* Section 1: Agent Info */}
      <section>
        <h3 className="text-sm font-semibold text-gray-400 mb-3">Agent Info</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard label="Name" value={agent.name || "-"} />
          <StatCard label="Agent ID" value={agent.agent_id} />
          <StatCard label="Status" value={agent.status} />
          <StatCard label="Category" value={agent.category || "-"} />
          <StatCard
            label="Protocols"
            value={agent.protocols?.join(", ") || "-"}
          />
          <StatCard
            label="Created"
            value={new Date(agent.created_at).toLocaleDateString()}
          />
        </div>
      </section>

      {/* Origin Endpoint */}
      <section>
        <h3 className="text-sm font-semibold text-gray-400 mb-3">Origin Endpoint</h3>
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
                {agent.origin_endpoint || "-"}
              </code>
              <button
                onClick={() => {
                  setEndpointValue(agent.origin_endpoint || "");
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

      {/* Section 2: SDK Integration */}
      <section>
        <h3 className="text-sm font-semibold text-gray-400 mb-3">SDK Integration</h3>
        <div className="p-4 rounded-lg border border-gray-800 bg-gray-900 space-y-3">
          <div>
            <p className="text-sm font-medium text-white">Ingest API</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Send request logs directly via the Ingest API using our SDK or manual integration.
            </p>
          </div>
          <CodeBlock code={ingestExample} label="Example Request" />
        </div>
      </section>

      {/* Section 4: API Key */}
      <section>
        <h3 className="text-sm font-semibold text-gray-400 mb-3">API Key</h3>
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

      {/* Section 5: ERC-8004 Identity */}
      <section>
        <h3 className="text-sm font-semibold text-gray-400 mb-3">
          ERC-8004 Identity
        </h3>
        <div className="p-4 rounded-lg border border-gray-800 bg-gray-900">
          {agent.evm_address ? (
            <div className="flex items-center gap-3">
              <code className="text-sm font-mono text-gray-300">
                {agent.evm_address}
              </code>
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
              {verifyError && (
                <p className="text-sm text-red-400">{verifyError}</p>
              )}
              {!hasWallet() && (
                <p className="text-xs text-gray-600">
                  MetaMask or a compatible wallet is required.
                </p>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
