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

async function openFetcherPost<T>(path: string, body: unknown, apiKey?: string): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }
  const res = await fetch(`${OPEN_API_BASE}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

async function openFetcherPut<T>(path: string, body: unknown, apiKey?: string): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }
  const res = await fetch(`${OPEN_API_BASE}${path}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

async function openFetcherDelete(path: string, apiKey?: string): Promise<void> {
  const headers: Record<string, string> = {};
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }
  const res = await fetch(`${OPEN_API_BASE}${path}`, {
    method: "DELETE",
    headers,
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
  avg_response_ms: number;
  gateway_enabled: boolean;
  evm_address?: string;
  reputation_score?: number;
  erc8004_token_id?: number;
  agent_uri?: string;
  created_at: string;
}

export interface RegisterRequest {
  name?: string;
  origin_endpoint: string;
  category?: string;
  protocols?: string[];
  pricing?: { model: string; amount: number; currency: string };
  // ERC-8004 (optional)
  erc8004_token_id?: number;
  chain_id?: number;
  wallet_address?: string;
  challenge?: string;
  signature?: string;
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
}

// ---------- Network Agents (on-chain discovery) ----------

export interface NetworkAgent {
  id: string;
  chain_id: number;
  token_id: number;
  owner_address: string;
  agent_uri: string;
  created_at: string;
  synced_at: string;
}

export interface NetworkStats {
  total: number;
  by_chain: Record<number, number>;
}

// ---------- 8004scan API (proxied via /api/scan) ----------

export interface ScanAgent {
  name: string;
  token_id: string;
  chain_id: number;
  total_score: number;
  total_feedbacks: number;
  is_active: boolean;
  rank: number;
  description: string;
  image_url: string | null;
  owner_address: string;
  created_at: string;
}

export async function fetchScanAgent(chainId: number, tokenId: number): Promise<ScanAgent | null> {
  try {
    const res = await fetch(`/api/scan?chain_id=${chainId}&token_id=${tokenId}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function fetchScanAgents(
  tokens: { token_id: number; chain_id: number }[]
): Promise<Map<string, ScanAgent>> {
  const results = await Promise.allSettled(
    tokens.map((t) => fetchScanAgent(t.chain_id, t.token_id))
  );
  const map = new Map<string, ScanAgent>();
  results.forEach((r, i) => {
    if (r.status === "fulfilled" && r.value) {
      const key = `${tokens[i].chain_id}-${tokens[i].token_id}`;
      map.set(key, r.value);
    }
  });
  return map;
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

  // Authenticated (apiKey required)
  getCustomers: (agentId: string, apiKey: string, limit = 50, offset = 0) =>
    openFetcher<{ customers: Customer[]; total: number }>(
      `/v1/agents/${agentId}/customers?limit=${limit}&offset=${offset}`,
      apiKey
    ),
  getCustomer: (agentId: string, apiKey: string, customerId: string) =>
    openFetcher<Customer>(
      `/v1/agents/${agentId}/customers/${customerId}`,
      apiKey
    ),
  getRevenue: (agentId: string, apiKey: string, period = "monthly") =>
    openFetcher<RevenueReport>(
      `/v1/agents/${agentId}/revenue?period=${period}`,
      apiKey
    ),
  getPerformance: (agentId: string, apiKey: string, window = "24h") =>
    openFetcher<PerformanceReport>(
      `/v1/agents/${agentId}/performance?window=${window}`,
      apiKey
    ),
  getLogs: (agentId: string, apiKey: string, limit = 50) =>
    openFetcher<{ logs: RequestLog[]; total: number }>(
      `/v1/agents/${agentId}/logs?limit=${limit}`,
      apiKey
    ),

  getStats: (agentId: string, apiKey: string) =>
    openFetcher<AgentStats>(
      `/v1/agents/${agentId}/stats`,
      apiKey
    ),
  getDailyStats: (agentId: string, apiKey: string, days = 30) =>
    openFetcher<{ stats: DailyStats[] }>(
      `/v1/agents/${agentId}/stats/daily?days=${days}`,
      apiKey
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

  // Gateway (auth required)
  enableGateway: (agentId: string, apiKey: string) =>
    openFetcherPost<{ message: string }>(
      `/v1/agents/${agentId}/gateway/enable`,
      {},
      apiKey
    ),
  disableGateway: (agentId: string, apiKey: string) =>
    openFetcherPost<{ message: string }>(
      `/v1/agents/${agentId}/gateway/disable`,
      {},
      apiKey
    ),

  // Agent settings (auth required)
  updateOriginEndpoint: (apiKey: string, endpoint: string) =>
    openFetcherPut<Agent>("/v1/agents/me/endpoint", { origin_endpoint: endpoint }, apiKey),

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
  getNetworkStats: () =>
    openFetcher<NetworkStats>("/v1/network/stats"),
};
