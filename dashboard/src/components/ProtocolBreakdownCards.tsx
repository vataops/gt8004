import type { ProtocolStats } from "@/lib/api";

export function ProtocolBreakdownCards({
  protocols,
}: {
  protocols: ProtocolStats[];
}) {
  if (!protocols || protocols.length === 0) {
    return (
      <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-lg p-8 text-center">
        <p className="text-zinc-500 text-sm">No protocol data available yet.</p>
      </div>
    );
  }

  // Group by protocol (HTTP, MCP, A2A)
  const protocolMap = new Map<string, ProtocolStats>();
  protocols.forEach((p) => {
    const key = p.protocol || "Unknown";
    if (!protocolMap.has(key)) {
      protocolMap.set(key, p);
    } else {
      // Aggregate if multiple entries for same protocol
      const existing = protocolMap.get(key)!;
      existing.request_count += p.request_count || 0;
      existing.percentage += p.percentage || 0;
      existing.avg_response_ms =
        ((existing.avg_response_ms || 0) + (p.avg_response_ms || 0)) / 2;
      existing.p95_response_ms =
        ((existing.p95_response_ms || 0) + (p.p95_response_ms || 0)) / 2;
      existing.error_rate = ((existing.error_rate || 0) + (p.error_rate || 0)) / 2;
    }
  });

  const protocolArray = Array.from(protocolMap.values());

  return (
    <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-lg p-5">
      <h3 className="text-sm font-medium text-zinc-400 mb-4">
        Performance by Protocol
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {protocolArray.map((proto) => {
          const errorColor =
            (proto.error_rate || 0) > 0.05
              ? "text-red-400"
              : (proto.error_rate || 0) > 0.02
              ? "text-yellow-400"
              : "text-green-400";

          return (
            <div
              key={proto.protocol}
              className="bg-[#141414] border border-[#1f1f1f] rounded-lg p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-white uppercase tracking-wide">
                  {proto.protocol}
                </h4>
                <span className="text-xs text-zinc-500 font-mono">
                  {(proto.percentage || 0).toFixed(0)}% load
                </span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">P95 Latency</span>
                  <span className="font-mono text-[#00FFE0]">
                    {(proto.p95_response_ms || 0).toFixed(0)}ms
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Avg Latency</span>
                  <span className="font-mono text-gray-300">
                    {(proto.avg_response_ms || 0).toFixed(0)}ms
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Error Rate</span>
                  <span className={`font-mono ${errorColor}`}>
                    {((proto.error_rate || 0) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Requests</span>
                  <span className="font-mono text-gray-300">
                    {(proto.request_count || 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
