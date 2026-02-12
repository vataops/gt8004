export interface AgentRow {
  agent_id: string;
  name: string;
  token_id: number | null;
  total_requests: number;
  total_customers: number;
  total_revenue: number;
  avg_response_ms: number;
  registered: boolean;
  origin_endpoint: string;
}

// Aggregation functions
export function aggregateTotalRequests(agents: AgentRow[]): number {
  return agents.reduce((sum, a) => sum + a.total_requests, 0);
}

export function aggregateTotalRevenue(agents: AgentRow[]): number {
  return agents.reduce((sum, a) => sum + a.total_revenue, 0);
}

export function aggregateTotalCustomers(agents: AgentRow[]): number {
  return agents.reduce((sum, a) => sum + a.total_customers, 0);
}

export function calculatePortfolioARPU(agents: AgentRow[]): number {
  const totalRevenue = aggregateTotalRevenue(agents);
  const totalRequests = aggregateTotalRequests(agents);
  return totalRequests > 0 ? totalRevenue / totalRequests : 0;
}

export function countPayingAgents(agents: AgentRow[]): number {
  return agents.filter((a) => a.total_revenue > 0).length;
}

// Ranking functions
export function rankAgentsByRequests(agents: AgentRow[]): AgentRow[] {
  return [...agents].sort((a, b) => b.total_requests - a.total_requests);
}

export function rankAgentsByRevenue(agents: AgentRow[]): AgentRow[] {
  return [...agents].sort((a, b) => b.total_revenue - a.total_revenue);
}

export function rankAgentsByCustomers(agents: AgentRow[]): AgentRow[] {
  return [...agents].sort((a, b) => b.total_customers - a.total_customers);
}

// Percentage calculations
export function calculatePercentage(value: number, total: number): number {
  return total > 0 ? (value / total) * 100 : 0;
}

// Health analysis
export function calculateHealthSummary(
  agents: AgentRow[],
  healthStatus: Record<string, "checking" | "healthy" | "unhealthy">
): {
  total: number;
  healthy: number;
  unhealthy: number;
  checking: number;
  avgResponseMs: number;
  minResponseMs: number;
  maxResponseMs: number;
} {
  const agentsWithEndpoints = agents.filter((a) => a.origin_endpoint && a.registered);
  const total = agentsWithEndpoints.length;
  const healthy = Object.values(healthStatus).filter((s) => s === "healthy").length;
  const unhealthy = Object.values(healthStatus).filter((s) => s === "unhealthy").length;
  const checking = Object.values(healthStatus).filter((s) => s === "checking").length;

  const responseTimes = agents.map((a) => a.avg_response_ms).filter((ms) => ms > 0);
  const avgResponseMs =
    responseTimes.length > 0
      ? responseTimes.reduce((sum, ms) => sum + ms, 0) / responseTimes.length
      : 0;
  const minResponseMs = responseTimes.length > 0 ? Math.min(...responseTimes) : 0;
  const maxResponseMs = responseTimes.length > 0 ? Math.max(...responseTimes) : 0;

  return { total, healthy, unhealthy, checking, avgResponseMs, minResponseMs, maxResponseMs };
}

export function getAgentsRequiringAttention(
  agents: AgentRow[],
  healthStatus: Record<string, "checking" | "healthy" | "unhealthy">
): Array<{ agent: AgentRow; reason: string }> {
  const result: Array<{ agent: AgentRow; reason: string }> = [];

  for (const agent of agents) {
    if (healthStatus[agent.agent_id] === "unhealthy") {
      result.push({ agent, reason: "Unhealthy (origin endpoint check failed)" });
    } else if (agent.avg_response_ms > 1000) {
      result.push({
        agent,
        reason: `High latency (${agent.avg_response_ms.toFixed(0)}ms avg)`,
      });
    } else if (agent.registered && !agent.origin_endpoint) {
      result.push({ agent, reason: "No origin endpoint configured" });
    }
  }

  return result;
}

// Stats range calculations
export function calculateRequestRange(agents: AgentRow[]): { min: number; max: number } {
  if (agents.length === 0) return { min: 0, max: 0 };
  const requests = agents.map((a) => a.total_requests);
  return {
    min: Math.min(...requests),
    max: Math.max(...requests),
  };
}

export function calculateAveragePerAgent(total: number, agentCount: number): number {
  return agentCount > 0 ? total / agentCount : 0;
}
