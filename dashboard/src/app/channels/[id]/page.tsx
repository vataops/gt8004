"use client";

import { useParams } from "next/navigation";
import { useChannel, useChannelTransactions } from "@/lib/hooks";

export default function ChannelDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { data, loading } = useChannel(id);
  const { data: txData } = useChannelTransactions(id);

  if (loading) return <p className="text-gray-500">Loading...</p>;
  if (!data) return <p className="text-red-400">Channel not found</p>;

  const channel = data.channel;
  const balances = data.balances || [];
  const transactions = txData?.transactions || [];

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">
        Channel{" "}
        <span className="font-mono text-blue-400">{channel.channel_id}</span>
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500">Status</p>
          <p className="text-lg font-bold mt-1 capitalize">{channel.status}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500">Mode / Type</p>
          <p className="text-lg font-bold mt-1">
            {channel.mode} / {channel.type}
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500">USDC Deposited</p>
          <p className="text-lg font-bold mt-1">
            ${channel.total_usdc_deposited.toFixed(2)}
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500">Avg Latency</p>
          <p className="text-lg font-bold mt-1">
            {channel.avg_latency_ms > 0
              ? `${channel.avg_latency_ms.toFixed(2)}ms`
              : "-"}
          </p>
        </div>
      </div>

      {balances.length > 0 && (
        <>
          <h3 className="text-lg font-semibold mb-3">Credit Balances</h3>
          <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500">
                  <th className="text-left p-3">Agent</th>
                  <th className="text-right p-3">Balance (CREDIT)</th>
                  <th className="text-right p-3">USDC Value</th>
                </tr>
              </thead>
              <tbody>
                {balances.map((b) => (
                  <tr
                    key={b.agent_id}
                    className="border-b border-gray-800/50 hover:bg-gray-800/30"
                  >
                    <td className="p-3 font-mono text-xs text-gray-400">
                      {b.agent_id}
                    </td>
                    <td className="p-3 text-right font-mono">
                      {b.balance.toLocaleString()}
                    </td>
                    <td className="p-3 text-right font-mono text-gray-400">
                      ${(b.balance / 1000).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h3 className="text-lg font-semibold mb-3">Transaction History</h3>
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-500">
              <th className="text-left p-3">Time</th>
              <th className="text-left p-3">From</th>
              <th className="text-left p-3">To</th>
              <th className="text-right p-3">Amount</th>
              <th className="text-left p-3">Memo</th>
              <th className="text-right p-3">Latency</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <tr
                key={tx.id}
                className="border-b border-gray-800/50 hover:bg-gray-800/30"
              >
                <td className="p-3 text-gray-400 font-mono text-xs">
                  {new Date(tx.created_at).toLocaleTimeString()}
                </td>
                <td className="p-3 font-mono text-xs text-gray-400">
                  {tx.from_address?.slice(0, 16) || "-"}
                </td>
                <td className="p-3 font-mono text-xs text-gray-400">
                  {tx.to_address?.slice(0, 16) || "-"}
                </td>
                <td className="p-3 text-right font-mono">
                  {tx.amount.toLocaleString()} CREDIT
                </td>
                <td className="p-3 text-gray-500 text-xs truncate max-w-xs">
                  {tx.memo || "-"}
                </td>
                <td className="p-3 text-right text-gray-400">
                  {tx.latency_ms ? `${tx.latency_ms.toFixed(2)}ms` : "-"}
                </td>
              </tr>
            ))}
            {transactions.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-gray-600">
                  No transactions yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
