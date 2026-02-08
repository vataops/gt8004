"use client";

import { useEventStream } from "@/lib/hooks";

export default function TransactionsPage() {
  const { events } = useEventStream();

  const txEvents = events.filter((e) => e.type === "tx_confirmed");

  return (
    <div>
      <h2 className="text-xl font-bold mb-2">Real-time Transaction Feed</h2>
      <p className="text-sm text-gray-500 mb-4">
        Live transactions via WebSocket ({txEvents.length} received)
      </p>

      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-500">
              <th className="text-left p-3">Time</th>
              <th className="text-left p-3">Channel</th>
              <th className="text-left p-3">From</th>
              <th className="text-left p-3">To</th>
              <th className="text-right p-3">Amount</th>
              <th className="text-left p-3">Memo</th>
              <th className="text-right p-3">Latency</th>
            </tr>
          </thead>
          <tbody>
            {txEvents.map((event, i) => {
              const p = event.payload as Record<string, unknown>;
              return (
                <tr
                  key={`${event.timestamp}-${i}`}
                  className="border-b border-gray-800/50 hover:bg-gray-800/30"
                >
                  <td className="p-3 text-gray-400 font-mono text-xs">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="p-3 font-mono text-xs text-gray-400">
                    {event.channel_id?.slice(0, 12) || "-"}
                  </td>
                  <td className="p-3 font-mono text-xs text-gray-400">
                    {(p.from as string)?.slice(0, 16) || "-"}
                  </td>
                  <td className="p-3 font-mono text-xs text-gray-400">
                    {(p.to as string)?.slice(0, 16) || "-"}
                  </td>
                  <td className="p-3 text-right font-mono">
                    {((p.amount as number) || 0).toLocaleString()} CREDIT
                  </td>
                  <td className="p-3 text-gray-500 text-xs truncate max-w-xs">
                    {(p.memo as string) || "-"}
                  </td>
                  <td className="p-3 text-right text-gray-400">
                    {p.latency_ms
                      ? `${(p.latency_ms as number).toFixed(2)}ms`
                      : "-"}
                  </td>
                </tr>
              );
            })}
            {txEvents.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-gray-600">
                  Waiting for transactions...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
