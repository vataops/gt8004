import { useMemo } from "react";
import { StatCard } from "@/components/StatCard";
import {
  rankAgentsByRequests,
  rankAgentsByCustomers,
  calculatePercentage,
  calculateRequestRange,
  calculateAveragePerAgent,
  aggregateTotalRequests,
  type AgentRow,
} from "@/lib/portfolio-utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
} from "recharts";

interface WalletDailyStats {
  date: string;
  requests: number;
  revenue: number;
  avg_response_ms: number;
  error_rate: number;
}

interface RequestsTabProps {
  agents: AgentRow[];
  walletDaily?: { stats: WalletDailyStats[] } | null;
}

const COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#ec4899"];

export function RequestsTab({ agents, walletDaily }: RequestsTabProps) {
  // Filter to only show registered agents
  const registeredAgents = useMemo(() => agents.filter(a => a.registered), [agents]);

  const totalRequests = useMemo(() => aggregateTotalRequests(registeredAgents), [registeredAgents]);
  const rankedByRequests = useMemo(() => rankAgentsByRequests(registeredAgents).slice(0, 10), [registeredAgents]);
  const rankedByCustomers = useMemo(() => rankAgentsByCustomers(registeredAgents).slice(0, 10), [registeredAgents]);
  const { min, max } = useMemo(() => calculateRequestRange(registeredAgents), [registeredAgents]);
  const avgPerAgent = useMemo(() => calculateAveragePerAgent(totalRequests, registeredAgents.length), [totalRequests, registeredAgents.length]);

  // Chart data for agent ranking
  const requestChartData = rankedByRequests.map((agent, i) => ({
    name: agent.token_id !== null && !agent.name.startsWith("Token #")
      ? `${agent.name} #${agent.token_id}`
      : agent.name,
    value: agent.total_requests,
    percentage: calculatePercentage(agent.total_requests, totalRequests),
    color: COLORS[i % COLORS.length],
  }));

  const customerChartData = rankedByCustomers.map((agent, i) => ({
    name: agent.token_id !== null && !agent.name.startsWith("Token #")
      ? `${agent.name} #${agent.token_id}`
      : agent.name,
    value: agent.total_customers,
    color: COLORS[i % COLORS.length],
  }));

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard
          label="Total Requests"
          value={totalRequests.toLocaleString()}
          sub={agents.length > 0 ? `From ${agents.length} agent${agents.length > 1 ? "s" : ""}` : undefined}
        />
        <StatCard
          label="Average per Agent"
          value={avgPerAgent.toFixed(0)}
          sub={max > 0 ? `Range: ${min.toLocaleString()} - ${max.toLocaleString()}` : undefined}
        />
      </div>

      {/* Top Agents by Requests */}
      {requestChartData.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h3 className="text-sm font-semibold text-gray-400 mb-4">
            Top Agents by Requests
          </h3>
          <ResponsiveContainer width="100%" height={Math.max(300, requestChartData.length * 40)}>
            <BarChart
              data={requestChartData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 5, bottom: 5 }}
            >
              <XAxis type="number" stroke="#6b7280" style={{ fontSize: 12 }} />
              <YAxis
                type="category"
                dataKey="name"
                stroke="#6b7280"
                style={{ fontSize: 12 }}
                width={150}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#111827",
                  border: "1px solid #1f2937",
                  borderRadius: "0.5rem",
                }}
                content={({ payload }) => {
                  if (!payload || !payload.length) return null;
                  const data = payload[0].payload;
                  return (
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-xs">
                      <div className="font-medium text-gray-200 mb-1">{data.name}</div>
                      <div className="text-gray-400">
                        {data.value.toLocaleString()} requests ({data.percentage.toFixed(1)}%)
                      </div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {requestChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top Agents by Customers */}
      {customerChartData.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h3 className="text-sm font-semibold text-gray-400 mb-4">
            Top Agents by Customers
          </h3>
          <ResponsiveContainer width="100%" height={Math.max(300, customerChartData.length * 40)}>
            <BarChart
              data={customerChartData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 5, bottom: 5 }}
            >
              <XAxis type="number" stroke="#6b7280" style={{ fontSize: 12 }} />
              <YAxis
                type="category"
                dataKey="name"
                stroke="#6b7280"
                style={{ fontSize: 12 }}
                width={150}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#111827",
                  border: "1px solid #1f2937",
                  borderRadius: "0.5rem",
                }}
                content={({ payload }) => {
                  if (!payload || !payload.length) return null;
                  const data = payload[0].payload;
                  return (
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-xs">
                      <div className="font-medium text-gray-200 mb-1">{data.name}</div>
                      <div className="text-gray-400">
                        {data.value.toLocaleString()} customers
                      </div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {customerChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Requests Over Time (Time-Series Chart) */}
      {walletDaily && walletDaily.stats && walletDaily.stats.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h3 className="text-sm font-semibold text-gray-400 mb-4">
            Requests Over Time (Last 30 Days)
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={[...walletDaily.stats].reverse()}>
              <XAxis
                dataKey="date"
                stroke="#6b7280"
                style={{ fontSize: 12 }}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return `${date.getMonth() + 1}/${date.getDate()}`;
                }}
              />
              <YAxis stroke="#6b7280" style={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#111827",
                  border: "1px solid #1f2937",
                  borderRadius: "0.5rem",
                }}
                content={({ payload }) => {
                  if (!payload || !payload.length) return null;
                  const data = payload[0].payload;
                  return (
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-xs">
                      <div className="font-medium text-gray-200 mb-1">{data.date}</div>
                      <div className="text-blue-400">
                        {data.requests.toLocaleString()} requests
                      </div>
                    </div>
                  );
                }}
              />
              <Line
                type="monotone"
                dataKey="requests"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Agent Ranking Table */}
      {rankedByRequests.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-gray-800">
            <h3 className="text-sm font-semibold text-gray-400">Agent Ranking</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500">
                <th className="text-left p-3 w-12">Rank</th>
                <th className="text-left p-3">Agent</th>
                <th className="text-right p-3">Requests</th>
                <th className="text-right p-3">Customers</th>
                <th className="text-right p-3">Avg Response</th>
                <th className="text-right p-3">% of Total</th>
              </tr>
            </thead>
            <tbody>
              {rankedByRequests.map((agent, index) => (
                <tr
                  key={agent.agent_id}
                  className="border-b border-gray-800/50 hover:bg-gray-800/30"
                >
                  <td className="p-3 text-gray-400">#{index + 1}</td>
                  <td className="p-3">
                    <span className="font-medium text-gray-100">
                      {agent.name}
                    </span>
                    {agent.token_id !== null && !agent.name.startsWith("Token #") && (
                      <span className="text-gray-500 ml-1.5">
                        #{agent.token_id}
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-right text-gray-300">
                    {agent.total_requests.toLocaleString()}
                  </td>
                  <td className="p-3 text-right text-gray-300">
                    {agent.total_customers.toLocaleString()}
                  </td>
                  <td className="p-3 text-right text-gray-300">
                    {agent.avg_response_ms > 0 ? `${agent.avg_response_ms.toFixed(0)}ms` : "—"}
                  </td>
                  <td className="p-3 text-right text-gray-400">
                    {calculatePercentage(agent.total_requests, totalRequests).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {agents.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No agents found
        </div>
      )}
    </div>
  );
}
