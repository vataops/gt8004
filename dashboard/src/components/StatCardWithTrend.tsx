"use client";

import { LineChart, Line, ResponsiveContainer } from "recharts";

export function StatCardWithTrend({
  label,
  value,
  delta,
  trend,
  colorThreshold,
}: {
  label: string;
  value: string;
  delta?: number;
  trend?: number[];
  colorThreshold?: { good: number; warn: number };
}) {
  // Determine value color based on threshold (if provided)
  let valueColor = "text-white";
  if (colorThreshold && delta !== undefined) {
    if (label.toLowerCase().includes("error")) {
      // Lower is better for error rate
      const numValue = parseFloat(value);
      if (numValue <= colorThreshold.good) valueColor = "text-green-400";
      else if (numValue <= colorThreshold.warn) valueColor = "text-yellow-400";
      else valueColor = "text-red-400";
    } else if (label.toLowerCase().includes("uptime")) {
      // Higher is better for uptime
      const numValue = parseFloat(value);
      if (numValue >= colorThreshold.good) valueColor = "text-green-400";
      else if (numValue >= colorThreshold.warn) valueColor = "text-yellow-400";
      else valueColor = "text-red-400";
    }
  }

  // Prepare sparkline data
  const chartData = trend?.map((v, i) => ({ x: i, y: v })) || [];

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${valueColor}`}>{value}</p>

      {/* Delta indicator */}
      {delta !== undefined && delta !== 0 && (
        <div className="flex items-center gap-1 mt-1">
          <span className={delta > 0 ? "text-green-400" : "text-red-400"}>
            {delta > 0 ? "↑" : "↓"}
          </span>
          <span className="text-xs text-gray-500">
            {Math.abs(delta).toFixed(label.toLowerCase().includes("uptime") ? 2 : 1)}
            {label.toLowerCase().includes("throughput") ? "" : label.toLowerCase().includes("latency") ? "ms" : "%"}
          </span>
        </div>
      )}

      {/* Mini sparkline */}
      {trend && trend.length > 0 && (
        <div className="mt-2 h-8">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <Line
                type="monotone"
                dataKey="y"
                stroke="#3B82F6"
                strokeWidth={1.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
