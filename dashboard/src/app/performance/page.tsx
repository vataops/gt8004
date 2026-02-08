"use client";

import { usePerformance } from "@/lib/hooks";
import { useAuth } from "@/lib/auth";
import { RequireAuth } from "@/components/RequireAuth";
import { StatCard } from "@/components/StatCard";

export default function PerformancePage() {
  return (
    <RequireAuth>
      <PerformanceContent />
    </RequireAuth>
  );
}

function PerformanceContent() {
  const { agent, apiKey } = useAuth();
  const { data: perf, loading } = usePerformance(agent!.agent_id, apiKey!);

  if (loading || !perf) {
    return <p className="text-gray-500">Loading...</p>;
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Performance Monitoring</h2>

      <h3 className="text-sm font-semibold text-gray-400 mb-2">Latency</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="P50" value={`${perf.p50_response_ms.toFixed(1)}ms`} />
        <StatCard label="P95" value={`${perf.p95_response_ms.toFixed(1)}ms`} />
        <StatCard label="P99" value={`${perf.p99_response_ms.toFixed(1)}ms`} />
        <StatCard label="Average" value={`${perf.avg_response_ms.toFixed(1)}ms`} />
      </div>

      <h3 className="text-sm font-semibold text-gray-400 mb-2">Throughput</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Requests" value={perf.total_requests.toLocaleString()} />
        <StatCard label="Success" value={perf.success_requests.toLocaleString()} />
        <StatCard label="Errors" value={perf.error_requests.toLocaleString()} />
        <StatCard label="Error Rate" value={`${(perf.error_rate * 100).toFixed(2)}%`} />
      </div>

      <h3 className="text-sm font-semibold text-gray-400 mb-2">Availability</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Requests/min" value={perf.requests_per_min.toFixed(1)} />
        <StatCard label="Uptime" value={`${perf.uptime.toFixed(2)}%`} />
      </div>
    </div>
  );
}
