const OPEN_API_BASE = process.env.NEXT_PUBLIC_OPEN_API_URL || "http://localhost:8080";

async function openFetcher<T>(path: string, apiKey?: string): Promise<T> {
  const headers: Record<string, string> = {};
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }
  const res = await fetch(`${OPEN_API_BASE}${path}`, { headers });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
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
  if (!res.ok) throw new Error(`API error: ${res.status}`);
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
  if (!res.ok) throw new Error(`API error: ${res.status}`);
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
  if (!res.ok) throw new Error(`API error: ${res.status}`);
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
  created_at: string;
}

export interface RegisterRequest {
  agent_id: string;
  name?: string;
  origin_endpoint: string;
  category?: string;
  protocols?: string[];
  pricing?: { model: string; amount: number; currency: string };
}

export interface RegisterResponse {
  agent: Agent;
  api_key: string;
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

export interface AlertRule {
  id: string;
  agent_id: string;
  name: string;
  type: string;
  metric: string;
  operator: string;
  threshold: number;
  window_minutes: number;
  webhook_url?: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface AlertHistoryEntry {
  id: string;
  rule_id: string;
  agent_id: string;
  metric_value: number;
  threshold: number;
  message: string;
  notified: boolean;
  created_at: string;
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
  getAlerts: (agentId: string, apiKey: string) =>
    openFetcher<{ rules: AlertRule[] }>(
      `/v1/agents/${agentId}/alerts`,
      apiKey
    ),
  createAlert: (agentId: string, apiKey: string, rule: Partial<AlertRule>) =>
    openFetcherPost<AlertRule>(
      `/v1/agents/${agentId}/alerts`,
      rule,
      apiKey
    ),
  deleteAlert: (agentId: string, apiKey: string, alertId: string) =>
    openFetcherDelete(
      `/v1/agents/${agentId}/alerts/${alertId}`,
      apiKey
    ),
  getAlertHistory: (agentId: string, apiKey: string, limit = 50) =>
    openFetcher<{ history: AlertHistoryEntry[] }>(
      `/v1/agents/${agentId}/alerts/history?limit=${limit}`,
      apiKey
    ),
  getLogs: (agentId: string, apiKey: string, limit = 50) =>
    openFetcher<{ logs: RequestLog[]; total: number }>(
      `/v1/agents/${agentId}/logs?limit=${limit}`,
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
};
