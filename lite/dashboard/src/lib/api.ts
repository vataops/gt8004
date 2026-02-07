const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

async function fetcher<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "X-Admin-Key": process.env.NEXT_PUBLIC_ADMIN_API_KEY || "changeme",
    },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export interface Overview {
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

export interface Agent {
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

// REST API events (from /v1/admin/events)
export interface SystemEvent {
  id: number;
  event_type: string;
  channel_id?: string;
  agent_id?: string;
  payload: Record<string, unknown>;
  created_at: string;
}

// WebSocket events (from /v1/admin/events/ws)
export interface WsEvent {
  type: string;
  channel_id?: string;
  payload: Record<string, unknown>;
  timestamp: number;
}

export const api = {
  getOverview: () => fetcher<Overview>("/v1/admin/overview"),
  getChannels: () => fetcher<{ channels: Channel[] }>("/v1/admin/channels"),
  getChannel: (id: string) =>
    fetcher<ChannelDetail>(`/v1/admin/channels/${id}`),
  getChannelTransactions: (id: string) =>
    fetcher<{ transactions: TransactionLog[] }>(
      `/v1/admin/channels/${id}/transactions`
    ),
  getAgents: () => fetcher<{ agents: Agent[] }>("/v1/admin/agents"),
  getAgent: (id: string) => fetcher<Agent>(`/v1/admin/agents/${id}`),
  getEscrow: () => fetcher<EscrowOverview>("/v1/admin/escrow"),
  getEvents: () => fetcher<{ events: SystemEvent[] }>("/v1/admin/events"),
};
