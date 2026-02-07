"use client";

import { useOverview, useEvents } from "@/lib/hooks";

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

export default function OverviewPage() {
  const { data: overview, loading } = useOverview();
  const { data: eventsData } = useEvents();

  if (loading || !overview) {
    return <p className="text-gray-500">Loading...</p>;
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">System Overview</h2>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <StatCard label="Active Channels" value={overview.active_channels} />
        <StatCard label="Total Channels" value={overview.total_channels} />
        <StatCard label="Agents" value={overview.total_agents} />
        <StatCard
          label="Transactions"
          value={overview.total_transactions.toLocaleString()}
        />
        <StatCard
          label="USDC in Escrow"
          value={`$${overview.total_usdc_deposited.toFixed(2)}`}
        />
        <StatCard
          label="CREDIT Minted"
          value={overview.total_credits_minted.toLocaleString()}
        />
      </div>

      <h3 className="text-lg font-semibold mb-3">Recent Events</h3>
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-500">
              <th className="text-left p-3">Time</th>
              <th className="text-left p-3">Type</th>
              <th className="text-left p-3">Channel</th>
              <th className="text-left p-3">Details</th>
            </tr>
          </thead>
          <tbody>
            {(eventsData?.events || []).slice(0, 20).map((event) => (
              <tr
                key={event.id}
                className="border-b border-gray-800/50 hover:bg-gray-800/30"
              >
                <td className="p-3 text-gray-400 font-mono text-xs">
                  {new Date(event.created_at).toLocaleTimeString()}
                </td>
                <td className="p-3">
                  <span className="px-2 py-0.5 bg-blue-900/30 text-blue-400 rounded text-xs">
                    {event.event_type}
                  </span>
                </td>
                <td className="p-3 text-gray-400 font-mono text-xs">
                  {event.channel_id?.slice(0, 12) || "-"}
                </td>
                <td className="p-3 text-gray-500 text-xs truncate max-w-xs">
                  {JSON.stringify(event.payload)}
                </td>
              </tr>
            ))}
            {(!eventsData?.events || eventsData.events.length === 0) && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-gray-600">
                  No events yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
