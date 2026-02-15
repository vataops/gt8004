import { useMemo } from "react";
import { StatCard } from "@/components/StatCard";
import {
  rankAgentsByRevenue,
  calculatePercentage,
  calculatePortfolioARPU,
  countPayingAgents,
  aggregateTotalRevenue,
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
} from "recharts";

interface RevenueTabProps {
  agents: AgentRow[];
}

const COLORS = ["#10b981", "#34d399", "#6ee7b7", "#a7f3d0", "#d1fae5", "#f0fdf4"];

export function RevenueTab({ agents }: RevenueTabProps) {
  // Filter to only show registered agents
  const registeredAgents = useMemo(() => agents.filter(a => a.registered), [agents]);

  const totalRevenue = useMemo(() => aggregateTotalRevenue(registeredAgents), [registeredAgents]);
  const totalRequests = useMemo(() => aggregateTotalRequests(registeredAgents), [registeredAgents]);
  const portfolioARPU = useMemo(() => calculatePortfolioARPU(registeredAgents), [registeredAgents]);
  const payingAgents = useMemo(() => countPayingAgents(registeredAgents), [registeredAgents]);
  const rankedByRevenue = useMemo(() => rankAgentsByRevenue(registeredAgents).slice(0, 10), [registeredAgents]);

  // Chart data for revenue ranking
  const revenueChartData = rankedByRevenue
    .filter((agent) => agent.total_revenue > 0)
    .map((agent, i) => ({
      name: agent.token_id !== null && !agent.name.startsWith("Token #")
        ? `${agent.name} #${agent.token_id}`
        : agent.name,
      value: agent.total_revenue,
      percentage: calculatePercentage(agent.total_revenue, totalRevenue),
      color: COLORS[i % COLORS.length],
    }));

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="Total Revenue"
          value={`$${totalRevenue.toFixed(2)}`}
          sub="USDC"
        />
        <StatCard
          label="Portfolio ARPU"
          value={`$${portfolioARPU.toFixed(4)}`}
          sub="per request"
        />
        <StatCard
          label="Paying Agents"
          value={`${payingAgents} / ${registeredAgents.length}`}
          sub={registeredAgents.length > 0 ? `${((payingAgents / registeredAgents.length) * 100).toFixed(0)}% monetized` : undefined}
        />
      </div>

      {/* Top Agents by Revenue */}
      {revenueChartData.length > 0 && (
        <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-lg p-6">
          <h3 className="text-sm font-semibold text-zinc-400 mb-4">
            Top Agents by Revenue
          </h3>
          <ResponsiveContainer width="100%" height={Math.max(300, revenueChartData.length * 40)}>
            <BarChart
              data={revenueChartData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 5, bottom: 5 }}
            >
              <XAxis
                type="number"
                stroke="#71717a"
                style={{ fontSize: 12 }}
                tickFormatter={(value) => `$${value.toFixed(2)}`}
              />
              <YAxis
                type="category"
                dataKey="name"
                stroke="#71717a"
                style={{ fontSize: 12 }}
                width={150}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f0f0f",
                  border: "1px solid #1a1a1a",
                  borderRadius: "0.5rem",
                }}
                content={({ payload }) => {
                  if (!payload || !payload.length) return null;
                  const data = payload[0].payload;
                  return (
                    <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-lg p-2.5 text-xs">
                      <div className="font-medium text-gray-200 mb-1">{data.name}</div>
                      <div className="text-emerald-400">
                        ${data.value.toFixed(2)} USDC ({data.percentage.toFixed(1)}%)
                      </div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {revenueChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Revenue Distribution Table */}
      {rankedByRevenue.filter((a) => a.total_revenue > 0).length > 0 && (
        <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-lg overflow-hidden">
          <div className="p-4 border-b border-[#1a1a1a]">
            <h3 className="text-sm font-semibold text-zinc-400">Revenue Distribution</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1a1a1a] text-zinc-400">
                <th className="text-left p-3 w-12">Rank</th>
                <th className="text-left p-3">Agent</th>
                <th className="text-right p-3">Revenue</th>
                <th className="text-right p-3">Requests</th>
                <th className="text-right p-3">ARPU</th>
                <th className="text-right p-3">% of Total</th>
              </tr>
            </thead>
            <tbody>
              {rankedByRevenue
                .filter((agent) => agent.total_revenue > 0)
                .map((agent, index) => {
                  const arpu = agent.total_requests > 0
                    ? agent.total_revenue / agent.total_requests
                    : 0;
                  return (
                    <tr
                      key={agent.agent_id}
                      className="border-b border-[#1a1a1a]/50 hover:bg-[#00FFE0]/5"
                    >
                      <td className="p-3 text-zinc-400">#{index + 1}</td>
                      <td className="p-3">
                        <span className="font-medium text-gray-100">
                          {agent.name}
                        </span>
                        {agent.token_id !== null && !agent.name.startsWith("Token #") && (
                          <span className="text-zinc-500 ml-1.5">
                            #{agent.token_id}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right text-emerald-400">
                        ${agent.total_revenue.toFixed(2)}
                      </td>
                      <td className="p-3 text-right text-gray-300">
                        {agent.total_requests.toLocaleString()}
                      </td>
                      <td className="p-3 text-right text-gray-300">
                        ${arpu.toFixed(4)}
                      </td>
                      <td className="p-3 text-right text-zinc-400">
                        {calculatePercentage(agent.total_revenue, totalRevenue).toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}

      {totalRevenue === 0 && (
        <div className="text-center py-12 text-zinc-500">
          No revenue data available
        </div>
      )}
    </div>
  );
}
