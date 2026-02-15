"use client";

import { useState } from "react";
import type { ToolUsage } from "@/lib/api";

export function ToolPerformanceTable({ tools }: { tools: ToolUsage[] }) {
  const [sortBy, setSortBy] = useState<"p95" | "calls" | "errors">("p95");

  if (!tools || tools.length === 0) {
    return (
      <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-lg p-8 text-center">
        <p className="text-zinc-500 text-sm">No tool usage data available yet.</p>
      </div>
    );
  }

  // Sort tools based on selected criteria
  const sortedTools = [...tools].sort((a, b) => {
    if (sortBy === "p95") return (b.p95_response_ms || 0) - (a.p95_response_ms || 0);
    if (sortBy === "calls") return (b.call_count || 0) - (a.call_count || 0);
    if (sortBy === "errors") return (b.error_rate || 0) - (a.error_rate || 0);
    return 0;
  });

  // Take top 10 slowest
  const displayTools = sortedTools.slice(0, 10);

  return (
    <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-zinc-400">
          Tool Performance (Top 10)
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => setSortBy("p95")}
            className={`px-3 py-1 text-xs rounded ${
              sortBy === "p95"
                ? "bg-[#00FFE0] text-black"
                : "bg-[#141414] text-zinc-400 hover:bg-[#1a1a1a]"
            }`}
          >
            By P95
          </button>
          <button
            onClick={() => setSortBy("calls")}
            className={`px-3 py-1 text-xs rounded ${
              sortBy === "calls"
                ? "bg-[#00FFE0] text-black"
                : "bg-[#141414] text-zinc-400 hover:bg-[#1a1a1a]"
            }`}
          >
            By Calls
          </button>
          <button
            onClick={() => setSortBy("errors")}
            className={`px-3 py-1 text-xs rounded ${
              sortBy === "errors"
                ? "bg-[#00FFE0] text-black"
                : "bg-[#141414] text-zinc-400 hover:bg-[#1a1a1a]"
            }`}
          >
            By Errors
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-zinc-400 border-b border-[#1a1a1a]">
              <th className="text-left pb-2 font-medium">Tool Name</th>
              <th className="text-right pb-2 font-medium">Calls</th>
              <th className="text-right pb-2 font-medium">Avg Latency</th>
              <th className="text-right pb-2 font-medium">P95 Latency</th>
              <th className="text-right pb-2 font-medium">Error Rate</th>
              <th className="text-right pb-2 font-medium">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {displayTools.map((tool, idx) => {
              const errorColor =
                (tool.error_rate || 0) > 0.05
                  ? "text-red-400"
                  : (tool.error_rate || 0) > 0.02
                  ? "text-yellow-400"
                  : "text-green-400";

              const isSlowTool = (tool.p95_response_ms || 0) > 500;

              return (
                <tr
                  key={tool.tool_name}
                  className="border-b border-[#1a1a1a]/50 hover:bg-[#00FFE0]/5"
                >
                  <td className="py-2 text-white font-mono flex items-center gap-2">
                    <span className="text-zinc-500 w-4">{idx + 1}.</span>
                    {tool.tool_name}
                    {isSlowTool && (
                      <span
                        className="text-yellow-400"
                        title="Slow tool (P95 > 500ms)"
                      >
                        ⚠
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-right text-gray-300 font-mono">
                    {(tool.call_count || 0).toLocaleString()}
                  </td>
                  <td className="py-2 text-right text-zinc-400 font-mono">
                    {(tool.avg_response_ms || 0).toFixed(0)}ms
                  </td>
                  <td className="py-2 text-right text-[#00FFE0] font-mono font-medium">
                    {(tool.p95_response_ms || 0).toFixed(0)}ms
                  </td>
                  <td className={`py-2 text-right font-mono ${errorColor}`}>
                    {((tool.error_rate || 0) * 100).toFixed(1)}%
                  </td>
                  <td className="py-2 text-right text-gray-300 font-mono">
                    ${(tool.revenue || 0).toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
