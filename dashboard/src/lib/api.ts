const OPEN_API_BASE = process.env.NEXT_PUBLIC_OPEN_API_URL || "http://localhost:8080";

async function parseError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return body.error || `API error: ${res.status}`;
  } catch {
    return `API error: ${res.status}`;
  }
}

async function openFetcher<T>(path: string, apiKey?: string): Promise<T> {
  const headers: Record<string, string> = {};
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }
  const res = await fetch(`${OPEN_API_BASE}${path}`, { headers });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

async function openFetcherPost<T>(
  path: string,
  body: unknown,
  auth?: string | { walletAddress: string },
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (typeof auth === "string") {
    headers["Authorization"] = `Bearer ${auth}`;
  } else if (auth?.walletAddress) {
    headers["X-Wallet-Address"] = auth.walletAddress;
  }
  const res = await fetch(`${OPEN_API_BASE}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

async function openFetcherPut<T>(path: string, body: unknown, auth?: string | { walletAddress: string }): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (typeof auth === "string") {
    headers["Authorization"] = `Bearer ${auth}`;
  } else if (auth?.walletAddress) {
    headers["X-Wallet-Address"] = auth.walletAddress;
  }
  const res = await fetch(`${OPEN_API_BASE}${path}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

async function openFetcherDelete(
  path: string,
  auth?: string | { walletAddress: string; challenge?: string; signature?: string }
): Promise<void> {
  const headers: Record<string, string> = {};
  let body: Record<string, string> | undefined;

  if (typeof auth === "string") {
    headers["Authorization"] = `Bearer ${auth}`;
  } else if (auth?.walletAddress) {
    headers["X-Wallet-Address"] = auth.walletAddress;
    if (auth.challenge && auth.signature) {
      headers["Content-Type"] = "application/json";
      body = {
        challenge: auth.challenge,
        signature: auth.signature,
      };
    }
  }

  const res = await fetch(`${OPEN_API_BASE}${path}`, {
    method: "DELETE",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await parseError(res));
}

// ---------- Types ----------
export interface Overview {
  total_agents: number;
  active_agents: number;
  total_requests: number;
  total_revenue_usdc: number;
  today_requests: number;
  avg_response_ms: number;
}

export interface Agent {
  id: string;
  agent_id: string;
  name: string;
  origin_endpoint: string;
  gt8004_endpoint: string;
  category: string;
  protocols: string[];
  status: string;
  total_requests: number;
  total_revenue_usdc: number;
  total_customers: number;
  avg_response_ms: number;
  gateway_enabled: boolean;
  evm_address?: string;
  reputation_score?: number;
  erc8004_token_id?: number;
  chain_id?: number;
  agent_uri?: string;
  current_tier?: string;
  created_at: string;
}

export interface RegisterRequest {
  // ERC-8004 fields - all metadata comes from contract
  // Backend verifies token ownership via RPC call
  erc8004_token_id: number;
  chain_id: number;
  wallet_address: string;

  // Service-level settings
  gateway_enabled?: boolean;
  origin_endpoint?: string; // Only required if gateway_enabled is true
  tier?: string;
  pricing?: { model: string; amount: number; currency: string };
}

export interface RegisterResponse {
  agent_id: string;
  api_key: string;
  gt8004_endpoint: string;
  dashboard_url: string;
  tier: string;
  status: string;
}

export interface ChallengeResponse {
  challenge: string;
  expires_at: string;
}

export interface VerifyResponse {
  verified: boolean;
  evm_address: string;
}

export interface Customer {
  id: string;
  customer_id: string;
  first_seen_at: string;
  last_seen_at: string;
  total_requests: number;
  total_revenue: number;
  avg_response_ms: number;
  error_rate: number;
  churn_risk: string;
  country: string;
  city: string;
}

export interface RevenuePeriod {
  period: string;
  amount: number;
  count: number;
}

export interface RevenueByTool {
  tool_name: string;
  amount: number;
  count: number;
}

export interface RevenueReport {
  periods: RevenuePeriod[];
  by_tool: RevenueByTool[];
  arpu: number;
  total_revenue: number;
}

export interface PerformanceReport {
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
  // New fields for Speed Insights improvement
  p75_response_ms: number;
  p90_response_ms: number;
  health_score: number;
  health_status: string;
  p95_trend: number[];
  error_rate_trend: number[];
  throughput_trend: number[];
  uptime_trend: number[];
  health_delta: number;
  p95_delta_ms: number;
  error_delta: number;
  throughput_delta: number;
  uptime_delta: number;
}

// Wallet analytics types
export interface WalletStats {
  total_requests: number;
  total_revenue: number;
  total_customers: number;
  avg_response_ms: number;
  error_rate: number;
  total_agents: number;
  active_agents: number;
}

export interface WalletDailyStats {
  date: string;
  requests: number;
  revenue: number;
  avg_response_ms: number;
  error_rate: number;
}

export interface WalletErrors {
  total_errors: number;
  error_rate: number;
  by_status_code: Array<{ status_code: number; count: number }>;
  by_error_type: Array<{ error_type: string; count: number }>;
  by_agent: Array<{
    agent_id: string;
    agent_name: string;
    error_count: number;
    error_rate: number;
  }>;
}

export interface BenchmarkEntry {
  id: string;
  category: string;
  agent_id: string;
  agent_name: string;
  agent_string_id: string;
  rank: number;
  score: number;
  total_requests: number;
  avg_response_ms: number;
  error_rate: number;
  revenue: number;
  customer_count: number;
  calculated_at: string;
}

export interface RequestLog {
  id: number;
  agent_id: string;
  request_id: string;
  customer_id?: string;
  tool_name?: string;
  method: string;
  path: string;
  status_code: number;
  response_ms: number;
  error_type?: string;
  x402_amount?: number;
  batch_id: string;
  sdk_version: string;
  protocol?: string;
  source?: string;
  ip_address?: string;
  user_agent?: string;
  referer?: string;
  content_type?: string;
  accept_language?: string;
  country?: string;
  city?: string;
  created_at: string;
}

export interface AgentStats {
  total_requests: number;
  today_requests: number;
  week_requests: number;
  month_requests: number;
  total_revenue_usdc: number;
  avg_response_ms: number;
  error_rate: number;
}

export interface DailyStats {
  date: string;
  requests: number;
  revenue: number;
  errors: number;
  unique_customers: number;
  avg_response_ms: number;
  p95_response_ms: number;
}

// ---------- Protocol Analytics ----------

export interface ProtocolStats {
  source: string;
  protocol: string;
  request_count: number;
  percentage: number;
  avg_response_ms: number;
  error_rate: number;
  p95_response_ms: number;
}

export interface ToolUsage {
  tool_name: string;
  call_count: number;
  avg_response_ms: number;
  p95_response_ms: number;
  error_rate: number;
  revenue: number;
}

export interface HealthMetrics {
  error_rate: number;
  payment_rate: number;
  timeout_rate: number;
  success_rate: number;
  total_requests: number;
  error_count: number;
  payment_count: number;
  timeout_count: number;
  window_minutes: number;
}

export interface TopCaller {
  customer_id: string;
  request_count: number;
  revenue: number;
  last_seen_at: string;
}

export interface CustomerIntelligence {
  total_customers: number;
  new_this_week: number;
  returning_this_week: number;
  top_callers: TopCaller[];
}

export interface AnalyticsRevenueSummary {
  total_revenue: number;
  payment_count: number;
  avg_per_request: number;
  arpu: number;
}

export interface DailyProtocolStats {
  date: string;
  source: string;
  protocol: string;
  requests: number;
  errors: number;
  revenue: number;
}

export interface A2APartner {
  customer_id: string;
  call_count: number;
  revenue: number;
  avg_response_ms: number;
  error_rate: number;
  last_seen_at: string;
}

export interface EndpointStats {
  endpoint: string;
  method: string;
  call_count: number;
  avg_response_ms: number;
  error_rate: number;
  revenue: number;
}

export interface AnalyticsReport {
  protocol: ProtocolStats[];
  tool_ranking: ToolUsage[];
  health: HealthMetrics;
  customers: CustomerIntelligence;
  revenue: AnalyticsRevenueSummary;
  daily_by_protocol: DailyProtocolStats[];
  mcp_tools: ToolUsage[];
  a2a_partners: A2APartner[];
  a2a_endpoints: EndpointStats[];
}

// ---------- Conversion Funnel ----------

export interface FunnelSummary {
  mcp_customers: number;
  mcp_to_a2a: number;
  mcp_to_a2a_paid: number;
  a2a_customers: number;
  a2a_to_paid: number;
  paid_customers: number;
  total_customers: number;
  mcp_to_a2a_rate: number;
  a2a_to_paid_rate: number;
  full_funnel_rate: number;
}

export interface DailyFunnelStats {
  date: string;
  mcp_customers: number;
  a2a_customers: number;
  paid_customers: number;
}

export interface CustomerJourney {
  customer_id: string;
  total_requests: number;
  total_revenue: number;
  has_mcp: boolean;
  has_a2a: boolean;
  has_a2a_paid: boolean;
  first_mcp_at?: string;
  first_a2a_at?: string;
  first_paid_at?: string;
  last_seen_at: string;
  days_to_convert?: number;
}

export interface FunnelReport {
  summary: FunnelSummary;
  daily_trend: DailyFunnelStats[];
  journeys: CustomerJourney[];
}

// ---------- On-Chain Reputation (IReputationRegistry) ----------

export interface ReputationSummary {
  token_id: number;
  chain_id: number;
  count: number;
  score: number;
}

export interface ReputationFeedbackEntry {
  client_address: string;
  feedback_index: number;
  value: number;
  tag1: string;
  tag2: string;
  is_revoked: boolean;
}

export interface ReputationFeedbacksResponse {
  token_id: number;
  chain_id: number;
  feedbacks: ReputationFeedbackEntry[];
}

// ---------- Network Agents (on-chain discovery) ----------

export interface AgentService {
  name: string;
  endpoint: string;
  version?: string;
  skills?: string[];
  domains?: string[];
  mcpTools?: string[];
  mcpPrompts?: string[];
  mcpResources?: string[];
}

export interface AgentMetadata {
  type?: string;
  name?: string;
  description?: string;
  image?: string;
  services?: AgentService[];
  endpoints?: AgentService[];
  x402Support?: boolean;
  x402support?: boolean;
  active?: boolean;
  registrations?: { agentId: number; agentRegistry: string }[];
  supportedTrust?: string[];
  supportedTrusts?: string[];
  [key: string]: unknown;
}

export interface NetworkAgent {
  id: string;
  chain_id: number;
  token_id: number;
  owner_address: string;
  agent_uri: string;
  name: string;
  description: string;
  image_url: string;
  metadata: AgentMetadata;
  creator_address: string;
  created_tx: string;
  created_at: string;
  synced_at: string;
}

export interface NetworkStats {
  total: number;
  by_chain: Record<number, number>;
}

// ---------- Customer Detail Types ----------

export interface CustomerToolUsage {
  tool_name: string;
  call_count: number;
  avg_response_ms: number;
  error_rate: number;
  revenue: number;
}

// ---------- API methods ----------
export const openApi = {
  // Public (no auth)
  getOverview: () => openFetcher<Overview>("/v1/dashboard/overview"),
  searchAgents: (category?: string) =>
    openFetcher<{ agents: Agent[]; total: number }>(
      `/v1/agents/search${category ? `?category=${category}` : ""}`
    ),
  searchAgentsAdvanced: (params: {
    category?: string;
    protocol?: string;
    min_reputation?: number;
    sort?: string;
  }) => {
    const query = new URLSearchParams();
    if (params.category) query.set("category", params.category);
    if (params.protocol) query.set("protocol", params.protocol);
    if (params.min_reputation)
      query.set("min_reputation", String(params.min_reputation));
    if (params.sort) query.set("sort", params.sort);
    return openFetcher<{ agents: Agent[]; total: number }>(
      `/v1/agents/search?${query.toString()}`
    );
  },
  getBenchmarkCategories: () =>
    openFetcher<{ categories: string[] }>("/v1/benchmark"),
  getBenchmark: (category: string) =>
    openFetcher<{
      category: string;
      rankings: BenchmarkEntry[];
      total: number;
    }>(`/v1/benchmark?category=${encodeURIComponent(category)}`),

  // Agent analytics (public, resolved by agent_id)
  getCustomers: (agentId: string, limit = 50, offset = 0) =>
    openFetcher<{ customers: Customer[]; total: number }>(
      `/v1/agents/${agentId}/customers?limit=${limit}&offset=${offset}`
    ),
  getCustomer: (agentId: string, customerId: string) =>
    openFetcher<Customer>(
      `/v1/agents/${agentId}/customers/${encodeURIComponent(customerId)}`
    ),
  getCustomerLogs: (agentId: string, customerId: string, limit = 50) =>
    openFetcher<{ logs: RequestLog[]; total: number }>(
      `/v1/agents/${agentId}/customers/${encodeURIComponent(customerId)}/logs?limit=${limit}`
    ),
  getCustomerTools: (agentId: string, customerId: string) =>
    openFetcher<{ tools: CustomerToolUsage[] }>(
      `/v1/agents/${agentId}/customers/${encodeURIComponent(customerId)}/tools`
    ),
  getCustomerDaily: (agentId: string, customerId: string, days = 30) =>
    openFetcher<{ stats: DailyStats[] }>(
      `/v1/agents/${agentId}/customers/${encodeURIComponent(customerId)}/daily?days=${days}`
    ),
  getRevenue: (agentId: string, period = "monthly") =>
    openFetcher<RevenueReport>(
      `/v1/agents/${agentId}/revenue?period=${period}`
    ),
  getPerformance: (agentId: string, window = "24h") =>
    openFetcher<PerformanceReport>(
      `/v1/agents/${agentId}/performance?window=${window}`
    ),
  getLogs: (agentId: string, limit = 50) =>
    openFetcher<{ logs: RequestLog[]; total: number }>(
      `/v1/agents/${agentId}/logs?limit=${limit}`
    ),
  getStats: (agentId: string) =>
    openFetcher<AgentStats>(
      `/v1/agents/${agentId}/stats`
    ),
  getDailyStats: (agentId: string, days = 30) =>
    openFetcher<{ stats: DailyStats[] }>(
      `/v1/agents/${agentId}/stats/daily?days=${days}`
    ),
  getAnalytics: (agentId: string, days = 30) =>
    openFetcher<AnalyticsReport>(
      `/v1/agents/${agentId}/analytics?days=${days}`
    ),
  getFunnel: (agentId: string, days = 30) =>
    openFetcher<FunnelReport>(
      `/v1/agents/${agentId}/funnel?days=${days}`
    ),
  // Registration (no auth)
  registerAgent: (req: RegisterRequest) =>
    openFetcherPost<RegisterResponse>("/v1/agents/register", req),

  // ERC-8004 Identity (no auth)
  getChallenge: (agentId: string) =>
    openFetcherPost<ChallengeResponse>(`/v1/auth/challenge`, { agent_id: agentId }),
  verifySignature: (agentId: string, challenge: string, signature: string) =>
    openFetcherPost<VerifyResponse>(`/v1/auth/verify`, {
      agent_id: agentId,
      challenge,
      signature,
    }),

  // ERC-8004 token verification (public, no auth)
  verifyToken: (tokenId: number) =>
    openFetcher<{ exists: boolean; token_id: number; owner?: string; agent_uri?: string; error?: string }>(
      `/v1/erc8004/token/${tokenId}`
    ),
  listTokensByOwner: (address: string, chainId?: number) =>
    openFetcher<{ tokens: { token_id: number; agent_uri: string }[]; error?: string }>(
      `/v1/erc8004/tokens/${address}${chainId ? `?chain_id=${chainId}` : ""}`
    ),

  // Link ERC-8004 to existing agent (auth required)
  linkERC8004: (agentId: string, apiKey: string, body: { erc8004_token_id: number; challenge: string; signature: string }) =>
    openFetcherPut<{ verified: boolean; evm_address: string; erc8004_token_id: number; agent_uri: string }>(
      `/v1/services/${agentId}/link-erc8004`,
      body,
      apiKey
    ),

  // Wallet login (public)
  walletLogin: (address: string, challenge: string, signature: string) =>
    openFetcherPost<{ agent: Agent; api_key: string }>("/v1/auth/wallet-login", {
      address,
      challenge,
      signature,
    }),

  // Wallet agents (public)
  getWalletAgents: (address: string) =>
    openFetcher<{ agents: Agent[]; total: number }>(
      `/v1/agents/wallet/${address}`
    ),

  // Wallet analytics (public)
  getWalletStats: (address: string) =>
    openFetcher<WalletStats>(`/v1/wallet/${address}/stats`),
  getWalletDailyStats: (address: string, days = 30) =>
    openFetcher<{ stats: WalletDailyStats[] }>(
      `/v1/wallet/${address}/daily?days=${days}`
    ),
  getWalletErrors: (address: string) =>
    openFetcher<WalletErrors>(`/v1/wallet/${address}/errors`),

  // Gateway (API key or wallet owner)
  enableGateway: (agentId: string, auth: string | { walletAddress: string }) =>
    openFetcherPost<{ gateway_enabled: boolean; gateway_url: string }>(
      `/v1/agents/${agentId}/gateway/enable`,
      {},
      auth
    ),
  disableGateway: (agentId: string, auth: string | { walletAddress: string }) =>
    openFetcherPost<{ gateway_enabled: boolean; origin_endpoint: string }>(
      `/v1/agents/${agentId}/gateway/disable`,
      {},
      auth
    ),

  // API key management (API key or wallet owner)
  regenerateAPIKey: (agentId: string, auth: string | { walletAddress: string }) =>
    openFetcherPost<{ api_key: string }>(
      `/v1/agents/${agentId}/api-key/regenerate`,
      {},
      auth
    ),

  // Agent settings (auth required)
  updateOriginEndpoint: (agentId: string, endpoint: string, auth: string | { walletAddress: string }) =>
    openFetcherPut<Agent>(`/v1/agents/${agentId}/endpoint`, { origin_endpoint: endpoint }, auth),

  // On-chain reputation (public)
  getReputationSummary: (tokenId: number, chainId?: number) =>
    openFetcher<ReputationSummary>(
      `/v1/erc8004/reputation/${tokenId}/summary${chainId ? `?chain_id=${chainId}` : ""}`
    ),
  getReputationFeedbacks: (tokenId: number, chainId?: number, limit?: number) => {
    const query = new URLSearchParams();
    if (chainId) query.set("chain_id", String(chainId));
    if (limit) query.set("limit", String(limit));
    const qs = query.toString();
    return openFetcher<ReputationFeedbacksResponse>(
      `/v1/erc8004/reputation/${tokenId}/feedbacks${qs ? `?${qs}` : ""}`
    );
  },

  // Network agents (public — on-chain discovery)
  getNetworkAgents: (params: { chain_id?: number; search?: string; limit?: number; offset?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.chain_id) query.set("chain_id", String(params.chain_id));
    if (params.search) query.set("search", params.search);
    if (params.limit) query.set("limit", String(params.limit));
    if (params.offset) query.set("offset", String(params.offset));
    const qs = query.toString();
    return openFetcher<{ agents: NetworkAgent[]; total: number }>(
      `/v1/network/agents${qs ? `?${qs}` : ""}`
    );
  },
  getNetworkAgent: (chainId: number, tokenId: number) =>
    openFetcher<NetworkAgent>(`/v1/network/agents/${chainId}/${tokenId}`),
  getNetworkStats: () =>
    openFetcher<NetworkStats>("/v1/network/stats"),

  deregisterAgent: (
    agentId: string,
    auth: string | { walletAddress: string; challenge?: string; signature?: string }
  ) => openFetcherDelete(`/v1/services/${agentId}`, auth),
};
