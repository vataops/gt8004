const DEFAULT_ENDPOINT = 'https://api.gt8004.network';

export interface GT8004ClientConfig {
  apiKey: string;
  endpoint?: string;
}

export interface SearchParams {
  category?: string;
  protocol?: string;
  min_reputation?: number;
  sort?: 'reputation' | 'requests' | 'revenue' | 'response_time' | 'newest';
}

export interface AgentInfo {
  id: string;
  agent_id: string;
  name: string;
  category: string;
  protocols: string[];
  status: string;
  total_requests: number;
  avg_response_ms: number;
  reputation_score: number;
}

export interface RegisterResult {
  agent_id: string;
  gt8004_endpoint: string;
  dashboard_url: string;
  api_key: string;
  status: string;
}

export interface RegisterServiceParams {
  origin_endpoint: string;
  agent_id?: string;
  name?: string;
  protocols?: string[];
  category?: string;
  pricing?: { model: string; amount: string; currency: string };
  tier?: 'open' | 'lite';
  // ERC-8004 (optional)
  erc8004_token_id?: number;
  challenge?: string;
  signature?: string;
}

export interface LinkERC8004Params {
  erc8004_token_id: number;
  challenge: string;
  signature: string;
}

export interface LinkERC8004Result {
  verified: boolean;
  evm_address: string;
  erc8004_token_id: number;
  agent_uri: string;
}

export interface TokenVerification {
  exists: boolean;
  token_id: number;
  owner?: string;
  agent_uri?: string;
  error?: string;
}

export interface RegisterServiceResult extends RegisterResult {
  tier: string;
}

export interface ServiceStatus {
  agent_id: string;
  name: string;
  tier: string;
  status: string;
  evm_address?: string;
  open: {
    total_requests: number;
    total_revenue_usdc: number;
    reputation_score: number;
  };
  lite?: {
    active_channels: number;
  };
  erc8004?: {
    token_id: number;
    verified: boolean;
  };
}

export interface TierUpdateResult {
  agent_id: string;
  tier: string;
  tier_updated_at: string;
}

export class GT8004Client {
  private endpoint: string;
  private apiKey: string;

  constructor(config: GT8004ClientConfig) {
    this.endpoint = config.endpoint ?? DEFAULT_ENDPOINT;
    this.apiKey = config.apiKey;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const res = await fetch(`${this.endpoint}${path}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      throw new Error(`GT8004 API error: ${res.status} ${res.statusText}`);
    }

    return res.json() as Promise<T>;
  }

  /** Search for agents in the marketplace. */
  async searchAgents(params: SearchParams = {}): Promise<{ agents: AgentInfo[]; total: number }> {
    const query = new URLSearchParams();
    if (params.category) query.set('category', params.category);
    if (params.protocol) query.set('protocol', params.protocol);
    if (params.min_reputation) query.set('min_reputation', String(params.min_reputation));
    if (params.sort) query.set('sort', params.sort);
    return this.request(`/v1/agents/search?${query.toString()}`);
  }

  /** Get agent stats. */
  async getStats(agentId: string): Promise<Record<string, unknown>> {
    return this.request(`/v1/agents/${agentId}/stats`);
  }

  /** Get performance report. */
  async getPerformance(agentId: string, window = '24h'): Promise<Record<string, unknown>> {
    return this.request(`/v1/agents/${agentId}/performance?window=${window}`);
  }

  /** Get request logs. */
  async getLogs(agentId: string, limit = 50): Promise<Record<string, unknown>> {
    return this.request(`/v1/agents/${agentId}/logs?limit=${limit}`);
  }

  /** Get benchmark rankings for a category. */
  async getBenchmark(category: string): Promise<Record<string, unknown>> {
    return this.request(`/v1/benchmark?category=${encodeURIComponent(category)}`);
  }

  // === Service Lifecycle (Unified Agent) ===

  /** Register a new service with the unified GT8004 agent. */
  async registerService(params: RegisterServiceParams): Promise<RegisterServiceResult> {
    return this.request('/v1/services/register', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  /** Get the current service status for an agent across all tiers. */
  async getService(agentId: string): Promise<ServiceStatus> {
    return this.request(`/v1/services/${agentId}`);
  }

  /** Upgrade or downgrade the service tier for an agent. */
  async updateTier(agentId: string, tier: 'open' | 'lite', evmAddress?: string): Promise<TierUpdateResult> {
    return this.request(`/v1/services/${agentId}/tier`, {
      method: 'PUT',
      body: JSON.stringify({ tier, evm_address: evmAddress }),
    });
  }

  /** Deregister an agent from the GT8004 service. */
  async deregister(agentId: string): Promise<{ status: string }> {
    return this.request(`/v1/services/${agentId}`, {
      method: 'DELETE',
    });
  }

  // === ERC-8004 Identity ===

  /** Request a challenge for wallet signature verification. */
  async authChallenge(agentId: string): Promise<{ challenge: string; expires_at: string }> {
    return this.request('/v1/auth/challenge', {
      method: 'POST',
      body: JSON.stringify({ agent_id: agentId }),
    });
  }

  /** Verify an ERC-8004 token on-chain (public, no auth). */
  async verifyToken(tokenId: number): Promise<TokenVerification> {
    return this.request(`/v1/erc8004/token/${tokenId}`);
  }

  /** Link an ERC-8004 token to an existing agent. */
  async linkERC8004(agentId: string, params: LinkERC8004Params): Promise<LinkERC8004Result> {
    return this.request(`/v1/services/${agentId}/link-erc8004`, {
      method: 'PUT',
      body: JSON.stringify(params),
    });
  }
}
