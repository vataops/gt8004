const DEFAULT_ENDPOINT = 'https://api.aes.network';

export interface AESClientConfig {
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
  aes_endpoint: string;
  dashboard_url: string;
  api_key: string;
  status: string;
}

export class AESClient {
  private endpoint: string;
  private apiKey: string;

  constructor(config: AESClientConfig) {
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
      throw new Error(`AES API error: ${res.status} ${res.statusText}`);
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

  /** Enable the API gateway for the authenticated agent. */
  async enableGateway(agentId: string): Promise<{ gateway_enabled: boolean }> {
    return this.request(`/v1/agents/${agentId}/gateway/enable`, { method: 'POST' });
  }

  /** Disable the API gateway for the authenticated agent. */
  async disableGateway(agentId: string): Promise<{ gateway_enabled: boolean }> {
    return this.request(`/v1/agents/${agentId}/gateway/disable`, { method: 'POST' });
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
}
