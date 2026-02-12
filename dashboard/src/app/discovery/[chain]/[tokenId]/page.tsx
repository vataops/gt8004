"use client";

import { useState, useEffect, useCallback } from "react";
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

type TabKey = "overview" | "feedback" | "metadata";

function truncateAddr(addr: string): string {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function getExplorerUrl(chainId: number, type: "address" | "tx", value: string): string | null {
  const key = CHAIN_ID_TO_KEY[chainId];
  const base = NETWORKS[key]?.blockExplorer;
  if (!base || !value) return null;
  return `${base}/${type}/${value}`;
}

export default function AgentDetailPage() {
  const params = useParams<{ chain: string; tokenId: string }>();
  const router = useRouter();

  const chainId = CHAIN_KEY_TO_ID[params.chain] ?? (Number(params.chain) && CHAIN_ID_TO_KEY[Number(params.chain)] ? Number(params.chain) : 0);
  const tokenId = Number(params.tokenId) || 0;

  const { data: agent, loading, error } = useNetworkAgent(chainId, tokenId);

  const [reputation, setReputation] = useState<ReputationSummary | null>(null);
  const [feedbacks, setFeedbacks] = useState<ReputationFeedbackEntry[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  useEffect(() => {
    if (!tokenId || !chainId) return;
    openApi.getReputationSummary(tokenId, chainId)
      .then(setReputation)
      .catch(() => setReputation(null));
    openApi.getReputationFeedbacks(tokenId, chainId, 20)
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

  const services = (agent?.metadata?.services ?? agent?.metadata?.endpoints ?? []).filter((s: AgentService) => s.name !== "OASF");
  const trusts = agent?.metadata?.supportedTrust || agent?.metadata?.supportedTrusts || [];
  const hasX402 = !!(agent?.metadata?.x402Support || agent?.metadata?.x402support);
  const avgScore = reputation?.score ?? 0;
  const feedbackCount = reputation?.count ?? 0;
  const overallScore = feedbackCount > 0 ? Math.min(100, +(avgScore * 20).toFixed(1)) : 0;

  const TABS: { key: TabKey; label: string; count?: number }[] = [
    { key: "overview", label: "Overview" },
    { key: "feedback", label: "Feedback", count: feedbackCount },
    { key: "metadata", label: "Metadata" },
  ];

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
        <div className="space-y-4">
          <div className="h-20 bg-gray-800/50 rounded-lg animate-pulse" />
          <div className="h-10 bg-gray-800/50 rounded-lg animate-pulse w-1/2" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 h-64 bg-gray-800/50 rounded-lg animate-pulse" />
            <div className="h-64 bg-gray-800/50 rounded-lg animate-pulse" />
          </div>
        </div>
      ) : error || !agent ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Agent not found</p>
          <p className="text-sm text-gray-600 mt-2">
            Token #{tokenId} on {params.chain}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* ───── Header ───── */}
          <div className="flex items-start gap-5">
            {resolveImageUrl(agent.image_url) ? (
              <img
                src={resolveImageUrl(agent.image_url)!}
                alt={agent.name || `Token #${agent.token_id}`}
                className="w-16 h-16 rounded-lg object-cover bg-gray-800 shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-gray-800 flex items-center justify-center text-2xl text-gray-600 shrink-0">
                #
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <ChainBadge chainId={agent.chain_id} />
                <h1 className="text-xl font-bold text-gray-100 truncate">
                  {agent.name || `Token #${agent.token_id}`}
                </h1>
                {agent.name && (
                  <span className="text-sm text-gray-500 shrink-0">
                    #{agent.token_id}
                  </span>
                )}
              </div>
              {agent.description && (
                <p className="text-sm text-gray-400 mt-1 line-clamp-2">
                  {agent.description}
                </p>
              )}
              {/* Meta info row */}
              <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                {feedbackCount > 0 && (
                  <span>{feedbackCount} feedback{feedbackCount !== 1 ? "s" : ""}</span>
                )}
                {agent.synced_at && (
                  <span>Last active {timeAgo(agent.synced_at)}</span>
                )}
              </div>
              {/* Trust badges */}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {agent.metadata?.active !== undefined && (
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    agent.metadata.active
                      ? "bg-green-900/30 text-green-400 border border-green-800/50"
                      : "bg-red-900/30 text-red-400 border border-red-800/50"
                  }`}>
                    {agent.metadata.active ? "Active" : "Inactive"}
                  </span>
                )}
                {feedbackCount > 0 && (
                  <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-gray-800 text-gray-300 border border-gray-700">
                    Reputation
                  </span>
                )}
                {hasX402 && (
                  <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-amber-900/30 text-amber-400 border border-amber-800/50">
                    x402
                  </span>
                )}
                {trusts.map((t: string) => (
                  <span key={t} className="text-xs px-2.5 py-1 rounded-full font-medium bg-purple-900/30 text-purple-400 border border-purple-800/50">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* ───── Tab Navigation ───── */}
          <div className="border-b border-gray-800">
            <div className="flex gap-0">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-5 py-3 text-sm font-medium transition-colors relative ${
                    activeTab === tab.key
                      ? "text-gray-100"
                      : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  {tab.label}
                  {tab.count !== undefined && (
                    <span className="ml-1.5 text-gray-600">({tab.count})</span>
                  )}
                  {activeTab === tab.key && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* ───── Overview Tab ───── */}
          {activeTab === "overview" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column */}
              <div className="lg:col-span-2 space-y-6">
                {/* Statistics Overview */}
                <Section title="Statistics Overview" icon="chart">
                  <div className="grid grid-cols-3 gap-3">
                    <StatCard
                      label="Average Score"
                      value={`${avgScore.toFixed(1)}/5.0`}
                      sub={feedbackCount > 0 ? `(${Math.round(avgScore * 20)}/100)` : undefined}
                      color="amber"
                    />
                    <StatCard
                      label="Total Feedback"
                      value={String(feedbackCount)}
                      color="blue"
                    />
                    <StatCard
                      label="Overall Score"
                      value={overallScore.toFixed(1)}
                      color="green"
                    />
                  </div>
                </Section>

                {/* Services */}
                <ServicesWithHealth services={services} />

                {/* Feedback preview */}
                <Section title="Feedback" icon="feedback">
                  {feedbacks.length === 0 ? (
                    <div className="py-8 text-center">
                      <div className="text-3xl text-gray-700 mb-2">💬</div>
                      <p className="text-sm text-gray-500">No feedback yet</p>
                      <p className="text-xs text-gray-600 mt-1">
                        This agent hasn&apos;t received any feedback from users.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {feedbacks.slice(0, 3).map((fb, i) => (
                        <FeedbackCard key={i} fb={fb} />
                      ))}
                      {feedbacks.length > 3 && (
                        <button
                          onClick={() => setActiveTab("feedback")}
                          className="text-xs text-blue-400 hover:text-blue-300 mt-2"
                        >
                          View all {feedbackCount} feedbacks →
                        </button>
                      )}
                    </div>
                  )}
                </Section>
              </div>

              {/* Right Column - Basic Information */}
              <div className="space-y-6">
                <div className="bg-gray-900 border border-gray-800 rounded-lg">
                  <div className="px-4 py-3 border-b border-gray-800">
                    <h3 className="text-sm font-semibold text-gray-300">Basic Information</h3>
                  </div>
                  <div className="p-4 space-y-4">
                    {/* Contract State */}
                    <SidebarSection label="CONTRACT STATE">
                      <SidebarRow label="AGENT ID" value={String(agent.token_id)} copyable />
                      <SidebarRow label="CHAIN" value={NETWORKS[CHAIN_ID_TO_KEY[agent.chain_id]]?.name ?? `Chain ${agent.chain_id}`} />
                      <SidebarRow
                        label="OWNER"
                        value={agent.owner_address}
                        truncate
                        copyable
                        explorerUrl={getExplorerUrl(agent.chain_id, "address", agent.owner_address)}
                      />
                      {agent.creator_address && (
                        <SidebarRow
                          label="CREATOR"
                          value={agent.creator_address}
                          truncate
                          copyable
                          explorerUrl={getExplorerUrl(agent.chain_id, "address", agent.creator_address)}
                        />
                      )}
                      {agent.created_tx && (
                        <SidebarRow
                          label="CREATED TX"
                          value={agent.created_tx}
                          truncate
                          copyable
                          explorerUrl={getExplorerUrl(agent.chain_id, "tx", agent.created_tx)}
                        />
                      )}
                      <SidebarRow
                        label="REGISTRY"
                        value={NETWORKS[CHAIN_ID_TO_KEY[agent.chain_id]]?.contractAddress ?? "—"}
                        truncate
                        copyable
                        explorerUrl={getExplorerUrl(agent.chain_id, "address", NETWORKS[CHAIN_ID_TO_KEY[agent.chain_id]]?.contractAddress)}
                      />
                    </SidebarSection>

                    {/* On-Chain Metadata */}
                    <SidebarSection label="ON-CHAIN METADATA">
                      <SidebarRow
                        label="AGENT URI"
                        value={agent.agent_uri || "—"}
                        truncate
                        copyable
                      />
                      {agent.name && (
                        <SidebarRow label="NAME" value={agent.name} />
                      )}
                      {agent.metadata?.type && (
                        <SidebarRow label="TYPE" value={agent.metadata.type} truncate />
                      )}
                    </SidebarSection>

                    {/* Timestamps */}
                    <SidebarSection label="TIMESTAMPS">
                      <SidebarRow
                        label="CREATED"
                        value={agent.created_at ? timeAgo(agent.created_at) : "—"}
                      />
                      <SidebarRow
                        label="LAST UPDATED"
                        value={agent.synced_at ? timeAgo(agent.synced_at) : "—"}
                      />
                    </SidebarSection>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ───── Feedback Tab ───── */}
          {activeTab === "feedback" && (
            <div className="max-w-2xl">
              {feedbacks.length === 0 ? (
                <div className="bg-gray-900 border border-gray-800 rounded-lg py-16 text-center">
                  <div className="text-4xl text-gray-700 mb-3">💬</div>
                  <p className="text-gray-400 font-medium">No feedback yet</p>
                  <p className="text-sm text-gray-600 mt-1">
                    This agent hasn&apos;t received any feedback from users.
                  </p>
                </div>
              ) : (
                <Section title={`Feedback (${feedbackCount})`}>
                  <div className="space-y-2">
                    {feedbacks.map((fb, i) => (
                      <FeedbackCard key={i} fb={fb} />
                    ))}
                  </div>
                </Section>
              )}
            </div>
          )}

          {/* ───── Metadata Tab ───── */}
          {activeTab === "metadata" && (
            <div className="max-w-2xl space-y-6">
              <Section title="Agent Metadata">
                <InfoGrid>
                  {agent.metadata?.type && (
                    <InfoRow label="Type" value={agent.metadata.type} />
                  )}
                  <InfoRow
                    label="x402 Support"
                    value={hasX402 ? "Yes" : "No"}
                  />
                  {trusts.length > 0 && (
                    <InfoRow
                      label="Supported Trust"
                      value={trusts.join(", ")}
                    />
                  )}
                </InfoGrid>
              </Section>

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

              {/* Raw Agent URI */}
              {agent.agent_uri && (
                <Section title="Raw Agent URI">
                  <div className="bg-gray-800/50 rounded-lg p-3">
                    <pre className="text-xs text-gray-400 font-mono whitespace-pre-wrap break-all max-h-64 overflow-y-auto">
                      {agent.agent_uri.startsWith("data:") ? decodeURIComponent(agent.agent_uri) : agent.agent_uri}
                    </pre>
                  </div>
                </Section>
              )}

              {/* No metadata notice */}
              {!agent.name && !agent.description && !services.length && (
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
      )}
    </div>
  );
}

// ════════════════════════════════════════════
// Helper Components
// ════════════════════════════════════════════

function Section({ title, children, icon }: { title: string; children: React.ReactNode; icon?: string }) {
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-sm text-gray-500 shrink-0 w-32">{label}</span>
      <span className="text-sm text-gray-200 text-right break-all">{value}</span>
    </div>
  );
}

// ── Sidebar Components ──

function SidebarSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-2">{label}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function SidebarRow({
  label,
  value,
  truncate,
  copyable,
  explorerUrl,
}: {
  label: string;
  value: string;
  truncate?: boolean;
  copyable?: boolean;
  explorerUrl?: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const displayValue = truncate && value.length > 16 ? truncateAddr(value) : value;

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-gray-500 shrink-0">{label}</span>
      <div className="flex items-center gap-1.5 min-w-0">
        <span className={`text-xs text-gray-200 truncate ${truncate ? "font-mono" : ""}`}>
          {displayValue}
        </span>
        {copyable && value && value !== "—" && (
          <button
            onClick={handleCopy}
            className="text-gray-600 hover:text-gray-400 shrink-0 transition-colors"
            title={copied ? "Copied!" : "Copy"}
          >
            {copied ? (
              <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            ) : (
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            )}
          </button>
        )}
        {explorerUrl && (
          <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-gray-400 shrink-0 transition-colors">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
          </a>
        )}
      </div>
    </div>
  );
}

// ── Stat Card ──

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: "amber" | "blue" | "green" }) {
  const colors = {
    amber: "from-amber-900/20 to-amber-900/5 border-amber-800/30",
    blue: "from-blue-900/20 to-blue-900/5 border-blue-800/30",
    green: "from-green-900/20 to-green-900/5 border-green-800/30",
  };
  const textColors = { amber: "text-amber-300", blue: "text-blue-300", green: "text-green-300" };

  return (
    <div className={`bg-gradient-to-b ${colors[color]} border rounded-lg p-4 text-center`}>
      <p className={`text-lg font-bold ${textColors[color]}`}>{value}</p>
      {sub && <p className="text-[10px] text-gray-500">{sub}</p>}
      <p className="text-[11px] text-gray-500 mt-1">{label}</p>
    </div>
  );
}

// ── Feedback Card ──

function FeedbackCard({ fb }: { fb: ReputationFeedbackEntry }) {
  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-3">
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
  );
}

// ── Chain / Service Badges ──

function ChainBadge({ chainId }: { chainId: number }) {
  const isBase = chainId === 84532;
  const key = CHAIN_ID_TO_KEY[chainId];
  const name = NETWORKS[key]?.shortName || `Chain ${chainId}`;
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
      isBase ? "bg-blue-900/30 text-blue-400" : "bg-purple-900/30 text-purple-400"
    }`}>
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
  return (
    <span className={`text-xs px-2 py-0.5 rounded font-medium ${colors[name] || "bg-gray-700/50 text-gray-300"}`}>
      {name}
    </span>
  );
}

// ── Services with Health Checks ──

function ServicesWithHealth({ services }: { services: AgentService[] }) {
  const [healthStatus, setHealthStatus] = useState<Record<string, "checking" | "healthy" | "unhealthy">>({});
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const runHealthChecks = useCallback(() => {
    const withEndpoints = services.filter((s) => s.endpoint);
    if (withEndpoints.length === 0) return;

    const init: Record<string, "checking"> = {};
    for (const svc of withEndpoints) init[svc.endpoint] = "checking";
    setHealthStatus(init);
    setLastChecked(new Date());

    const BACKEND_URL = process.env.NEXT_PUBLIC_OPEN_API_URL || "http://localhost:8080";
    for (const svc of withEndpoints) {
      const url = svc.endpoint;
      const healthUrl = `${BACKEND_URL}/v1/proxy/health?endpoint=${encodeURIComponent(url)}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      fetch(healthUrl, { method: "GET", signal: controller.signal })
        .then(async (res) => {
          clearTimeout(timeout);
          const data = await res.json().catch(() => ({}));
          setHealthStatus((prev) => ({ ...prev, [url]: data.status === "healthy" ? "healthy" : "unhealthy" }));
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
        <p className="text-xs text-gray-500">Agent communication services</p>
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
            <div key={i} className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-3">
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
                  <span className={`flex items-center gap-1 text-xs ${
                    status === "healthy" ? "text-green-400" : status === "unhealthy" ? "text-red-400" : "text-gray-500"
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${
                      status === "healthy" ? "bg-green-400" : status === "unhealthy" ? "bg-red-400" : "bg-gray-500 animate-pulse"
                    }`} />
                    {status === "healthy" ? "Healthy" : status === "unhealthy" ? "Unhealthy" : "Checking"}
                  </span>
                )}
              </div>
              {svc.mcpTools && svc.mcpTools.length > 0 && (
                <div className="mt-2">
                  <span className="text-xs text-gray-500">Tools: </span>
                  <span className="text-xs text-gray-300">{svc.mcpTools.join(", ")}</span>
                </div>
              )}
              {svc.mcpPrompts && svc.mcpPrompts.length > 0 && (
                <div className="mt-1">
                  <span className="text-xs text-gray-500">Prompts: </span>
                  <span className="text-xs text-gray-300">{svc.mcpPrompts.join(", ")}</span>
                </div>
              )}
              {svc.mcpResources && svc.mcpResources.length > 0 && (
                <div className="mt-1">
                  <span className="text-xs text-gray-500">Resources: </span>
                  <span className="text-xs text-gray-300">{svc.mcpResources.join(", ")}</span>
                </div>
              )}
              {svc.skills && svc.skills.length > 0 && (
                <div className="mt-2">
                  <span className="text-xs text-gray-500">Skills: </span>
                  <span className="text-xs text-gray-300">{svc.skills.join(", ")}</span>
                </div>
              )}
              {svc.domains && svc.domains.length > 0 && (
                <div className="mt-1">
                  <span className="text-xs text-gray-500">Domains: </span>
                  <span className="text-xs text-gray-300">{svc.domains.join(", ")}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}
