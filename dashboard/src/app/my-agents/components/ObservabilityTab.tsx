import { useMemo } from "react";
import { StatCard } from "@/components/StatCard";
import {
  calculateHealthSummary,
  getAgentsRequiringAttention,
  type AgentRow,
} from "@/lib/portfolio-utils";

interface WalletErrors {
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

interface ObservabilityTabProps {
  agents: AgentRow[];
  healthStatus: Record<string, "checking" | "healthy" | "unhealthy">;
  lastChecked: Date | null;
  walletErrors?: WalletErrors | null;
}

export function ObservabilityTab({
  agents,
  healthStatus,
  lastChecked,
  walletErrors,
}: ObservabilityTabProps) {
  // Filter to only show registered agents
  const registeredAgents = useMemo(() => agents.filter(a => a.registered), [agents]);

  // Filter to agents with at least one service endpoint
  const agentsWithEndpoints = useMemo(
    () => registeredAgents.filter(a => a.parsed_services?.some(s => s.endpoint && s.name !== "OASF")),
    [registeredAgents]
  );

  const healthSummary = useMemo(
    () => calculateHealthSummary(registeredAgents, healthStatus),
    [registeredAgents, healthStatus]
  );

  const agentsRequiringAttention = useMemo(
    () => getAgentsRequiringAttention(registeredAgents, healthStatus),
    [registeredAgents, healthStatus]
  );

  return (
    <div className="space-y-6">
      {/* Health Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="Health Status"
          value={
            healthSummary.total > 0
              ? `${healthSummary.healthy} / ${healthSummary.total}`
              : "—"
          }
          sub={
            healthSummary.total > 0
              ? `${healthSummary.unhealthy} unhealthy, ${healthSummary.checking} checking`
              : "No agents with endpoints"
          }
        />
        <StatCard
          label="Avg Response Time"
          value={
            healthSummary.avgResponseMs > 0
              ? `${healthSummary.avgResponseMs.toFixed(0)}ms`
              : "—"
          }
          sub={
            healthSummary.maxResponseMs > 0
              ? `Range: ${healthSummary.minResponseMs.toFixed(0)}ms - ${healthSummary.maxResponseMs.toFixed(0)}ms`
              : undefined
          }
        />
        <StatCard
          label="Error Rate"
          value={
            walletErrors
              ? `${(walletErrors.error_rate * 100).toFixed(2)}%`
              : "—"
          }
          sub={
            walletErrors
              ? `${walletErrors.total_errors.toLocaleString()} total errors`
              : "Loading..."
          }
        />
      </div>

      {/* Last Checked */}
      {lastChecked && (
        <div className="text-xs text-gray-500">
          Last health check: {lastChecked.toLocaleString()}
        </div>
      )}

      {/* Health Status Grid */}
      {agentsWithEndpoints.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h3 className="text-sm font-semibold text-gray-400 mb-4">
            Agent Health Overview
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {agentsWithEndpoints
              .sort((a, b) => {
                // Sort: any unhealthy first, then checking, then all healthy
                const worstStatus = (agent: typeof a) => {
                  const statuses = agent.parsed_services
                    .filter(s => s.endpoint && s.name !== "OASF")
                    .map(s => healthStatus[`${agent.agent_id}:${s.endpoint}`] || "checking");
                  if (statuses.includes("unhealthy")) return 0;
                  if (statuses.includes("checking")) return 1;
                  return 2;
                };
                return worstStatus(a) - worstStatus(b);
              })
              .map((agent) => {
                const svcsWithEndpoint = agent.parsed_services.filter(s => s.endpoint && s.name !== "OASF");
                const hasUnhealthy = svcsWithEndpoint.some(
                  s => healthStatus[`${agent.agent_id}:${s.endpoint}`] === "unhealthy"
                );
                const allHealthy = svcsWithEndpoint.every(
                  s => healthStatus[`${agent.agent_id}:${s.endpoint}`] === "healthy"
                );
                const cardColor = hasUnhealthy
                  ? "border-red-800 bg-red-900/10"
                  : allHealthy
                  ? "border-green-800 bg-green-900/10"
                  : "border-gray-700 bg-gray-800/30";

                return (
                  <div
                    key={agent.agent_id}
                    className={`border rounded-lg p-3 ${cardColor}`}
                  >
                    <div className="font-medium text-sm text-gray-100 mb-2">
                      {agent.name}
                      {agent.token_id !== null &&
                        !agent.name.startsWith("Token #") && (
                          <span className="text-gray-500 ml-1">
                            #{agent.token_id}
                          </span>
                        )}
                    </div>
                    <div className="flex flex-col gap-1">
                      {svcsWithEndpoint.map((svc, i) => {
                        const status = healthStatus[`${agent.agent_id}:${svc.endpoint}`] || "checking";
                        return (
                          <div key={i} className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${
                              status === "healthy" ? "bg-green-400"
                              : status === "unhealthy" ? "bg-red-400"
                              : "bg-gray-500 animate-pulse"
                            }`} />
                            <span className="text-xs text-gray-300">{svc.name}</span>
                            <span className="text-[10px] text-gray-500 capitalize">{status}</span>
                          </div>
                        );
                      })}
                    </div>
                    {agent.avg_response_ms > 0 && (
                      <div className="text-xs text-gray-400 mt-2">
                        Avg: {agent.avg_response_ms.toFixed(0)}ms
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Agents Requiring Attention */}
      {agentsRequiringAttention.length > 0 && (
        <div className="bg-yellow-900/10 border border-yellow-800 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <svg
              className="w-5 h-5 text-yellow-400"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <h3 className="text-sm font-semibold text-yellow-400">
              Agents Requiring Attention
            </h3>
          </div>
          <div className="space-y-2">
            {agentsRequiringAttention.map(({ agent, reason }) => (
              <div
                key={agent.agent_id}
                className="flex items-start gap-3 text-sm"
              >
                <span className="text-yellow-400 mt-0.5">•</span>
                <div className="flex-1">
                  <span className="font-medium text-gray-100">
                    {agent.name}
                    {agent.token_id !== null &&
                      !agent.name.startsWith("Token #") && (
                        <span className="text-gray-500 ml-1">
                          #{agent.token_id}
                        </span>
                      )}
                  </span>
                  <span className="text-gray-400 ml-2">{reason}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Analysis */}
      {walletErrors && walletErrors.by_status_code.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h3 className="text-sm font-semibold text-gray-400 mb-4">
            Errors by Status Code
          </h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
                <th className="pb-2">Status Code</th>
                <th className="pb-2 text-right">Count</th>
              </tr>
            </thead>
            <tbody>
              {walletErrors.by_status_code.map((sc) => (
                <tr key={sc.status_code} className="border-b border-gray-800/50">
                  <td className="py-2 text-sm">{sc.status_code}</td>
                  <td className="py-2 text-sm text-right">{sc.count.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {walletErrors && walletErrors.by_agent.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h3 className="text-sm font-semibold text-gray-400 mb-4">
            Agents with Highest Error Rates
          </h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
                <th className="pb-2">Agent</th>
                <th className="pb-2 text-right">Errors</th>
                <th className="pb-2 text-right">Error Rate</th>
              </tr>
            </thead>
            <tbody>
              {walletErrors.by_agent.slice(0, 10).map((agent) => (
                <tr key={agent.agent_id} className="border-b border-gray-800/50">
                  <td className="py-2 text-sm">{agent.agent_name}</td>
                  <td className="py-2 text-sm text-right">
                    {agent.error_count.toLocaleString()}
                  </td>
                  <td className="py-2 text-sm text-right">
                    <span className={
                      agent.error_rate > 0.1 ? "text-red-400" :
                      agent.error_rate > 0.05 ? "text-yellow-400" :
                      "text-gray-400"
                    }>
                      {(agent.error_rate * 100).toFixed(2)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {agentsWithEndpoints.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No agents with origin endpoints configured
        </div>
      )}
    </div>
  );
}
