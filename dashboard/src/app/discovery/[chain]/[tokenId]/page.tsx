"use client";

import { useParams, useRouter } from "next/navigation";
import { useNetworkAgent } from "@/lib/hooks";
import { NETWORKS } from "@/lib/networks";
import type { AgentService } from "@/lib/api";

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
            {agent.image_url ? (
              <img
                src={agent.image_url}
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

          {/* Metadata */}
          <Section title="Metadata">
            <InfoGrid>
              <InfoRow
                label="x402 Support"
                value={agent.metadata?.x402Support ? "Yes" : "No"}
              />
              {agent.metadata?.supportedTrust && agent.metadata.supportedTrust.length > 0 && (
                <InfoRow
                  label="Supported Trust"
                  value={agent.metadata.supportedTrust.join(", ")}
                />
              )}
            </InfoGrid>
          </Section>

          {/* Services */}
          {agent.metadata?.services && agent.metadata.services.length > 0 && (
            <Section title="Services">
              <div className="space-y-3">
                {agent.metadata.services.map((svc: AgentService, i: number) => (
                  <div
                    key={i}
                    className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <ServiceBadge name={svc.name} />
                      {svc.version && (
                        <span className="text-xs text-gray-500">
                          v{svc.version}
                        </span>
                      )}
                    </div>
                    {svc.endpoint && (
                      <p className="text-sm font-mono text-gray-400 break-all">
                        {svc.endpoint}
                      </p>
                    )}
                    {svc.skills && svc.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {svc.skills.map((skill, j) => (
                          <span
                            key={j}
                            className="text-xs px-2 py-0.5 bg-gray-700/50 text-gray-300 rounded"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

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
          {!agent.name && !agent.description && (!agent.metadata?.services || agent.metadata.services.length === 0) && (
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
  };
  const color = colors[name] || "bg-gray-700/50 text-gray-300";

  return (
    <span className={`text-xs px-2 py-0.5 rounded font-medium ${color}`}>
      {name}
    </span>
  );
}
