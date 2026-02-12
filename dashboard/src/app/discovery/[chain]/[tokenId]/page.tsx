"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useNetworkAgent } from "@/lib/hooks";
import { NETWORKS, resolveImageUrl } from "@/lib/networks";
import { openApi } from "@/lib/api";
import type { AgentService, ReputationSummary, ReputationFeedbackEntry } from "@/lib/api";

// chain key → chainId mapping
const CHAIN_KEY_TO_ID: Record<string, number> = {};
for (const [key, cfg] of Object.entries(NETWORKS)) {
  CHAIN_KEY_TO_ID[key] = cfg.chainId;
}

// chainId → chain key mapping
const CHAIN_ID_TO_KEY: Record<number, string> = {};
for (const [key, cfg] of Object.entries(NETWORKS)) {
  CHAIN_ID_TO_KEY[cfg.chainId] = key;
}

export default function AgentDetailPage() {
  const params = useParams<{ chain: string; tokenId: string }>();
  const router = useRouter();

  const chainId = CHAIN_KEY_TO_ID[params.chain] ?? 0;
  const tokenId = Number(params.tokenId) || 0;

  const { data: agent, loading, error } = useNetworkAgent(chainId, tokenId);

  const [reputation, setReputation] = useState<ReputationSummary | null>(null);
  const [feedbacks, setFeedbacks] = useState<ReputationFeedbackEntry[]>([]);

  useEffect(() => {
    if (!tokenId || !chainId) return;
    openApi.getReputationSummary(tokenId, chainId)
      .then(setReputation)
      .catch(() => setReputation(null));
    openApi.getReputationFeedbacks(tokenId, chainId, 5)
      .then((res) => setFeedbacks(res.feedbacks ?? []))
      .catch(() => setFeedbacks([]));
  }, [tokenId, chainId]);

  if (!chainId) {
    return (
      <div className="p-8 text-center text-gray-500">
        Unknown chain: {params.chain}
      </div>
    );
  }

  return (
    <div>
      {/* Back button */}
      <button
        onClick={() => router.push("/discovery")}
        className="text-sm text-gray-400 hover:text-gray-200 mb-6 flex items-center gap-1"
      >
        <span>←</span> Back to Registry
      </button>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : error || !agent ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Agent not found</p>
          <p className="text-sm text-gray-600 mt-2">
            Token #{tokenId} on {params.chain}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-start gap-5">
            {resolveImageUrl(agent.image_url) ? (
              <img
                src={resolveImageUrl(agent.image_url)!}
                alt={agent.name || `Token #${agent.token_id}`}
                className="w-16 h-16 rounded-lg object-cover bg-gray-800"
              />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-gray-800 flex items-center justify-center text-2xl text-gray-600">
                #
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-gray-100 truncate">
                  {agent.name || `Token #${agent.token_id}`}
                </h1>
                <span className="text-sm text-gray-500 shrink-0">
                  #{agent.token_id}
                </span>
              </div>
              {agent.description && (
                <p className="text-sm text-gray-400 mt-1 line-clamp-2">
                  {agent.description}
                </p>
              )}
              <div className="flex items-center gap-3 mt-2">
                <ChainBadge chainId={agent.chain_id} />
                {agent.metadata?.active !== undefined && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      agent.metadata.active
                        ? "bg-green-900/30 text-green-400"
                        : "bg-red-900/30 text-red-400"
                    }`}
                  >
                    {agent.metadata.active ? "Active" : "Inactive"}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Overview */}
          <Section title="Overview">
            <InfoGrid>
              <InfoRow label="Token ID" value={String(agent.token_id)} />
              <InfoRow label="Chain" value={NETWORKS[CHAIN_ID_TO_KEY[agent.chain_id]]?.name ?? `Chain ${agent.chain_id}`} />
              <InfoRow
                label="Owner"
                value={agent.owner_address || "—"}
                mono
                copyable
              />
              <InfoRow
                label="Agent URI"
                value={agent.agent_uri || "—"}
                link={agent.agent_uri && agent.agent_uri.startsWith("http") ? agent.agent_uri : undefined}
              />
              <InfoRow
                label="Contract"
                value={NETWORKS[CHAIN_ID_TO_KEY[agent.chain_id]]?.contractAddress ?? "—"}
                mono
                copyable
              />
              <InfoRow
                label="Created"
                value={agent.created_at ? new Date(agent.created_at).toLocaleString() : "—"}
              />
              <InfoRow
                label="Last Synced"
                value={agent.synced_at ? new Date(agent.synced_at).toLocaleString() : "—"}
              />
            </InfoGrid>
          </Section>

          {/* On-Chain Reputation */}
          {reputation && reputation.count > 0 && (
            <Section title="On-Chain Reputation">
              <InfoGrid>
                <InfoRow label="Feedback Count" value={String(reputation.count)} />
                <InfoRow label="Average Score" value={reputation.score.toFixed(2)} />
              </InfoGrid>
              {feedbacks.length > 0 && (
                <div className="mt-4 space-y-2">
                  <h4 className="text-xs text-gray-500 uppercase tracking-wider">Recent Feedback</h4>
                  {feedbacks.map((fb, i) => (
                    <div key={i} className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-gray-400">
                          {fb.client_address.slice(0, 6)}...{fb.client_address.slice(-4)}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${fb.value >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {fb.value >= 0 ? "+" : ""}{fb.value.toFixed(2)}
                          </span>
                          {fb.is_revoked && (
                            <span className="text-[10px] text-red-500 bg-red-900/20 px-1.5 py-0.5 rounded">Revoked</span>
                          )}
                        </div>
                      </div>
                      {(fb.tag1 || fb.tag2) && (
                        <div className="flex gap-2 mt-1.5">
                          {fb.tag1 && <span className="text-[10px] bg-gray-700/50 text-gray-400 px-1.5 py-0.5 rounded">{fb.tag1}</span>}
                          {fb.tag2 && <span className="text-[10px] bg-gray-700/50 text-gray-400 px-1.5 py-0.5 rounded">{fb.tag2}</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Section>
          )}

          {/* Metadata */}
          <Section title="Metadata">
            <InfoGrid>
              {agent.metadata?.type && (
                <InfoRow label="Type" value={agent.metadata.type} />
              )}
              <InfoRow
                label="x402 Support"
                value={agent.metadata?.x402Support || agent.metadata?.x402support ? "Yes" : "No"}
              />
              {(agent.metadata?.supportedTrust || agent.metadata?.supportedTrusts) && (
                <InfoRow
                  label="Supported Trust"
                  value={(agent.metadata.supportedTrust || agent.metadata.supportedTrusts || []).join(", ")}
                />
              )}
            </InfoGrid>
          </Section>

          {/* Services / Endpoints */}
          <ServicesWithHealth services={agent.metadata?.services ?? agent.metadata?.endpoints ?? []} />

          {/* Registrations */}
          {agent.metadata?.registrations && agent.metadata.registrations.length > 0 && (
            <Section title="Registrations">
              <div className="space-y-2">
                {agent.metadata.registrations.map((reg, i) => (
                  <div
                    key={i}
                    className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-3"
                  >
                    <p className="text-sm text-gray-300">
                      Agent ID: <span className="font-mono">{reg.agentId}</span>
                    </p>
                    <p className="text-sm text-gray-400 font-mono break-all mt-1">
                      {reg.agentRegistry}
                    </p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* No metadata notice */}
          {!agent.name && !agent.description && !(agent.metadata?.services ?? agent.metadata?.endpoints)?.length && (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 text-center">
              <p className="text-gray-500">
                No metadata available for this agent.
              </p>
              <p className="text-xs text-gray-600 mt-1">
                The agent URI may not be reachable or does not contain valid ERC-8004 metadata.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Helper Components ----

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg">
      <div className="px-4 py-3 border-b border-gray-800">
        <h3 className="text-sm font-semibold text-gray-300">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function InfoGrid({ children }: { children: React.ReactNode }) {
  return <div className="space-y-3">{children}</div>;
}

function InfoRow({
  label,
  value,
  mono,
  copyable,
  link,
}: {
  label: string;
  value: string;
  mono?: boolean;
  copyable?: boolean;
  link?: string;
}) {
  const handleCopy = () => {
    navigator.clipboard.writeText(value);
  };

  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-sm text-gray-500 shrink-0 w-32">{label}</span>
      <div className="flex items-center gap-2 min-w-0">
        {link ? (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className={`text-sm text-blue-400 hover:text-blue-300 break-all text-right ${
              mono ? "font-mono" : ""
            }`}
          >
            {value}
          </a>
        ) : (
          <span
            className={`text-sm text-gray-200 break-all text-right ${
              mono ? "font-mono" : ""
            }`}
          >
            {value}
          </span>
        )}
        {copyable && value !== "—" && (
          <button
            onClick={handleCopy}
            className="text-gray-600 hover:text-gray-400 text-xs shrink-0"
            title="Copy"
          >
            copy
          </button>
        )}
      </div>
    </div>
  );
}

function ChainBadge({ chainId }: { chainId: number }) {
  const isBase = chainId === 84532;
  const key = CHAIN_ID_TO_KEY[chainId];
  const name = NETWORKS[key]?.shortName || `Chain ${chainId}`;
  const bgColor = isBase ? "bg-blue-900/30" : "bg-purple-900/30";
  const textColor = isBase ? "text-blue-400" : "text-purple-400";

  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${bgColor} ${textColor}`}
    >
      {name}
    </span>
  );
}

function ServiceBadge({ name }: { name: string }) {
  const colors: Record<string, string> = {
    A2A: "bg-emerald-900/30 text-emerald-400",
    MCP: "bg-cyan-900/30 text-cyan-400",
    web: "bg-blue-900/30 text-blue-400",
    OASF: "bg-purple-900/30 text-purple-400",
  };
  const color = colors[name] || "bg-gray-700/50 text-gray-300";

  return (
    <span className={`text-xs px-2 py-0.5 rounded font-medium ${color}`}>
      {name}
    </span>
  );
}

function ServicesWithHealth({ services }: { services: AgentService[] }) {
  const [healthStatus, setHealthStatus] = useState<
    Record<string, "checking" | "healthy" | "unhealthy">
  >({});
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const runHealthChecks = useCallback(() => {
    const withEndpoints = services.filter((s) => s.endpoint);
    if (withEndpoints.length === 0) return;

    const init: Record<string, "checking"> = {};
    for (const svc of withEndpoints) init[svc.endpoint] = "checking";
    setHealthStatus(init);
    setLastChecked(new Date());

    for (const svc of withEndpoints) {
      const url = svc.endpoint;
      const base = url.replace(/\/+$/, "");
      const healthUrl = `${base}/.well-known/agent.json`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      fetch(healthUrl, { method: "GET", signal: controller.signal })
        .then((res) => {
          clearTimeout(timeout);
          setHealthStatus((prev) => ({ ...prev, [url]: res.ok ? "healthy" : "unhealthy" }));
        })
        .catch(() => {
          clearTimeout(timeout);
          setHealthStatus((prev) => ({ ...prev, [url]: "unhealthy" }));
        });
    }
  }, [services]);

  useEffect(() => { runHealthChecks(); }, [runHealthChecks]);

  if (services.length === 0) return null;

  return (
    <Section title="Services">
      <div className="flex items-center justify-between mb-3">
        <div />
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
          const status = svc.endpoint ? healthStatus[svc.endpoint] : undefined;
          return (
            <div
              key={i}
              className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ServiceBadge name={svc.name} />
                  {svc.endpoint && (
                    <a
                      href={svc.endpoint}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-gray-400 hover:text-gray-200 font-mono truncate max-w-xs"
                    >
                      {svc.endpoint}
                    </a>
                  )}
                </div>
                {status && (
                  <span
                    className={`flex items-center gap-1 text-xs ${
                      status === "healthy"
                        ? "text-green-400"
                        : status === "unhealthy"
                        ? "text-red-400"
                        : "text-gray-500"
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        status === "healthy"
                          ? "bg-green-400"
                          : status === "unhealthy"
                          ? "bg-red-400"
                          : "bg-gray-500 animate-pulse"
                      }`}
                    />
                    {status === "healthy"
                      ? "Healthy"
                      : status === "unhealthy"
                      ? "Unhealthy"
                      : "Checking"}
                  </span>
                )}
              </div>
              {/* MCP details */}
              {svc.mcpTools && svc.mcpTools.length > 0 && (
                <div className="mt-2">
                  <span className="text-xs text-gray-500">Tools: </span>
                  <span className="text-xs text-gray-300">
                    {svc.mcpTools.join(", ")}
                  </span>
                </div>
              )}
              {svc.mcpPrompts && svc.mcpPrompts.length > 0 && (
                <div className="mt-1">
                  <span className="text-xs text-gray-500">Prompts: </span>
                  <span className="text-xs text-gray-300">
                    {svc.mcpPrompts.join(", ")}
                  </span>
                </div>
              )}
              {svc.mcpResources && svc.mcpResources.length > 0 && (
                <div className="mt-1">
                  <span className="text-xs text-gray-500">Resources: </span>
                  <span className="text-xs text-gray-300">
                    {svc.mcpResources.join(", ")}
                  </span>
                </div>
              )}
              {/* OASF / A2A details */}
              {svc.skills && svc.skills.length > 0 && (
                <div className="mt-2">
                  <span className="text-xs text-gray-500">Skills: </span>
                  <span className="text-xs text-gray-300">
                    {svc.skills.join(", ")}
                  </span>
                </div>
              )}
              {svc.domains && svc.domains.length > 0 && (
                <div className="mt-1">
                  <span className="text-xs text-gray-500">Domains: </span>
                  <span className="text-xs text-gray-300">
                    {svc.domains.join(", ")}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}
