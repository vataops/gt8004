// ---------- Open API ----------
const OPEN_API_BASE = process.env.NEXT_PUBLIC_OPEN_API_URL || "http://localhost:8080";

async function openFetcher<T>(path: string, auth = false): Promise<T> {
  const headers: Record<string, string> = {};
  if (auth) {
    const key = process.env.NEXT_PUBLIC_API_KEY || "";
    if (key) headers["Authorization"] = `Bearer ${key}`;
  }
  const res = await fetch(`${OPEN_API_BASE}${path}`, { headers });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function openFetcherPost<T>(path: string, body: unknown, auth = false): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const key = process.env.NEXT_PUBLIC_API_KEY || "";
    if (key) headers["Authorization"] = `Bearer ${key}`;
  }
  const res = await fetch(`${OPEN_API_BASE}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function openFetcherDelete(path: string, auth = false): Promise<void> {
  const headers: Record<string, string> = {};
  if (auth) {
    const key = process.env.NEXT_PUBLIC_API_KEY || "";
    if (key) headers["Authorization"] = `Bearer ${key}`;
  }
  const res = await fetch(`${OPEN_API_BASE}${path}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
}

// ---------- Lite API ----------
const LITE_API_BASE = process.env.NEXT_PUBLIC_LITE_API_URL || "http://localhost:8081";

async function liteFetcher<T>(path: string): Promise<T> {
  const res = await fetch(`${LITE_API_BASE}${path}`, {
    headers: {
      "X-Admin-Key": process.env.NEXT_PUBLIC_ADMIN_API_KEY || "changeme",
    },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ---------- Open Types ----------
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
  aes_endpoint: string;
  category: string;
  protocols: string[];
  status: string;
  total_requests: number;
  total_revenue_usdc: number;
  avg_response_ms: number;
  created_at: string;
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

// ---------- Lite Types ----------
export interface LiteOverview {
  active_channels: number;
  total_channels: number;
  total_agents: number;
  total_transactions: number;
  total_usdc_deposited: number;
  total_credits_minted: number;
}

export interface Channel {
  id: string;
  channel_id: string;
  type: string;
  status: string;
  mode: string;
  total_usdc_deposited: number;
  total_credits_minted: number;
  total_transactions: number;
  avg_latency_ms: number;
  participant_count?: number;
  max_participants: number;
  created_at: string;
  opened_at?: string;
  closed_at?: string;
}

export interface CreditBalance {
  channel_id: string;
  agent_id: string;
  balance: number;
}

export interface ChannelDetail {
  channel: Channel;
  balances: CreditBalance[] | null;
}

export interface LiteAgent {
  id: string;
  agent_id: string;
  evm_address?: string;
  reputation_score?: number;
  verified_at?: string;
  created_at: string;
}

export interface TransactionLog {
  id: number;
  channel_id: string;
  tx_id?: string;
  from_address?: string;
  to_address?: string;
  amount: number;
  memo?: string;
  latency_ms?: number;
  status: string;
  created_at: string;
}

export interface EscrowOverview {
  total_usdc_deposited: number;
  total_credits_in_circulation: number;
  active_channels: number;
  settled_channels: number;
}

export interface SystemEvent {
  id: number;
  event_type: string;
  channel_id?: string;
  agent_id?: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface WsEvent {
  type: string;
  channel_id?: string;
  payload: Record<string, unknown>;
  timestamp: number;
}

// ---------- Open API methods ----------
export const openApi = {
  getOverview: () => openFetcher<Overview>("/v1/dashboard/overview"),
  searchAgents: (category?: string) =>
    openFetcher<{ agents: Agent[]; total: number }>(
      `/v1/agents/search${category ? `?category=${category}` : ""}`
    ),
  getCustomers: (agentId: string, limit = 50, offset = 0) =>
    openFetcher<{ customers: Customer[]; total: number }>(
      `/v1/agents/${agentId}/customers?limit=${limit}&offset=${offset}`,
      true
    ),
  getCustomer: (agentId: string, customerId: string) =>
    openFetcher<Customer>(`/v1/agents/${agentId}/customers/${customerId}`, true),
  getRevenue: (agentId: string, period = "monthly") =>
    openFetcher<RevenueReport>(
      `/v1/agents/${agentId}/revenue?period=${period}`,
      true
    ),
  getPerformance: (agentId: string, window = "24h") =>
    openFetcher<PerformanceReport>(
      `/v1/agents/${agentId}/performance?window=${window}`,
      true
    ),
  getAlerts: (agentId: string) =>
    openFetcher<{ rules: AlertRule[] }>(
      `/v1/agents/${agentId}/alerts`,
      true
    ),
  createAlert: (agentId: string, rule: Partial<AlertRule>) =>
    openFetcherPost<AlertRule>(
      `/v1/agents/${agentId}/alerts`,
      rule,
      true
    ),
  deleteAlert: (agentId: string, alertId: string) =>
    openFetcherDelete(
      `/v1/agents/${agentId}/alerts/${alertId}`,
      true
    ),
  getAlertHistory: (agentId: string, limit = 50) =>
    openFetcher<{ history: AlertHistoryEntry[] }>(
      `/v1/agents/${agentId}/alerts/history?limit=${limit}`,
      true
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
  getLogs: (agentId: string, limit = 50) =>
    openFetcher<{ logs: RequestLog[]; total: number }>(
      `/v1/agents/${agentId}/logs?limit=${limit}`,
      true
    ),
};

// ---------- Lite API methods ----------
export const liteApi = {
  getOverview: () => liteFetcher<LiteOverview>("/v1/admin/overview"),
  getChannels: () => liteFetcher<{ channels: Channel[] }>("/v1/admin/channels"),
  getChannel: (id: string) =>
    liteFetcher<ChannelDetail>(`/v1/admin/channels/${id}`),
  getChannelTransactions: (id: string) =>
    liteFetcher<{ transactions: TransactionLog[] }>(
      `/v1/admin/channels/${id}/transactions`
    ),
  getAgents: () => liteFetcher<{ agents: LiteAgent[] }>("/v1/admin/agents"),
  getAgent: (id: string) => liteFetcher<LiteAgent>(`/v1/admin/agents/${id}`),
  getEscrow: () => liteFetcher<EscrowOverview>("/v1/admin/escrow"),
  getEvents: () => liteFetcher<{ events: SystemEvent[] }>("/v1/admin/events"),
};
