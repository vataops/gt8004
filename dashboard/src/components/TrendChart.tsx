"use client";

import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { DailyStats } from "@/lib/api";

const tooltipStyle = {
  backgroundColor: "#111827",
  border: "1px solid #1F2937",
  borderRadius: "8px",
  fontSize: 12,
  boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
};

export function TrendChart({ data }: { data: DailyStats[] }) {
  const [timeWindow, setTimeWindow] = useState<"24h" | "7d">("7d");

  if (!data || data.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center">
        <p className="text-gray-500 text-sm">
          No historical trend data available yet.
        </p>
      </div>
    );
  }

  // Filter data based on time window
  const filteredData =
    timeWindow === "24h" ? data.slice(0, 1) : data.slice(0, 7);

  // Format data for chart
  const chartData = filteredData
    .map((d) => ({
      date: new Date(d.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      p95: d.p95_response_ms || 0,
      errorRate: ((d.errors || 0) / (d.requests || 1)) * 100,
      requests: d.requests || 0,
    }))
    .reverse(); // Reverse to show oldest to newest

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-400">
          Performance Trend
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => setTimeWindow("24h")}
            className={`px-3 py-1 text-xs rounded ${
              timeWindow === "24h"
                ? "bg-blue-500 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            24h
          </button>
          <button
            onClick={() => setTimeWindow("7d")}
            className={`px-3 py-1 text-xs rounded ${
              timeWindow === "7d"
                ? "bg-blue-500 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            7d
          </button>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "#6B7280" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 11, fill: "#6B7280" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}ms`}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 11, fill: "#6B7280" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v.toFixed(1)}%`}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value: number | undefined, name: string | undefined) => {
              if (value === undefined || name === undefined) return ["-", name || ""];
              if (name === "p95") return [`${value.toFixed(0)}ms`, "P95 Latency"];
              if (name === "errorRate")
                return [`${value.toFixed(2)}%`, "Error Rate"];
              return [value, name];
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 10 }}
            iconType="line"
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="p95"
            stroke="#3B82F6"
            strokeWidth={2}
            dot={{ r: 3 }}
            name="P95 Latency"
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="errorRate"
            stroke="#EF4444"
            strokeWidth={2}
            dot={{ r: 3 }}
            name="Error Rate"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
