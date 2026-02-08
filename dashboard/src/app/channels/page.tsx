"use client";

import Link from "next/link";
import { useChannels } from "@/lib/hooks";

const statusColor: Record<string, string> = {
  active: "bg-green-900/30 text-green-400",
  pending: "bg-yellow-900/30 text-yellow-400",
  settling: "bg-orange-900/30 text-orange-400",
  settled: "bg-gray-800 text-gray-400",
  failed: "bg-red-900/30 text-red-400",
};

export default function ChannelsPage() {
  const { data, loading } = useChannels();

  if (loading) return <p className="text-gray-500">Loading...</p>;

  const channels = data?.channels || [];

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Channels</h2>
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-500">
              <th className="text-left p-3">Channel ID</th>
              <th className="text-left p-3">Type</th>
              <th className="text-left p-3">Status</th>
              <th className="text-right p-3">Participants</th>
              <th className="text-right p-3">Transactions</th>
              <th className="text-right p-3">USDC</th>
              <th className="text-right p-3">Latency</th>
              <th className="text-left p-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {channels.map((ch) => (
              <tr
                key={ch.id}
                className="border-b border-gray-800/50 hover:bg-gray-800/30"
              >
                <td className="p-3 font-mono text-xs">
                  <Link
                    href={`/channels/${ch.channel_id}`}
                    className="text-blue-400 hover:underline"
                  >
                    {ch.channel_id}
                  </Link>
                </td>
                <td className="p-3 text-gray-400">{ch.type}</td>
                <td className="p-3">
                  <span
                    className={`px-2 py-0.5 rounded text-xs ${statusColor[ch.status] || "bg-gray-800 text-gray-400"}`}
                  >
                    {ch.status}
                  </span>
                </td>
                <td className="p-3 text-right text-gray-400">
                  {ch.participant_count ?? "-"}/{ch.max_participants}
                </td>
                <td className="p-3 text-right font-mono">
                  {ch.total_transactions.toLocaleString()}
                </td>
                <td className="p-3 text-right font-mono">
                  ${ch.total_usdc_deposited.toFixed(2)}
                </td>
                <td className="p-3 text-right text-gray-400">
                  {ch.avg_latency_ms > 0 ? `${ch.avg_latency_ms.toFixed(0)}ms` : "-"}
                </td>
                <td className="p-3 text-gray-500 text-xs">
                  {new Date(ch.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {channels.length === 0 && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-gray-600">
                  No channels yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
