"use client";

import { useState } from "react";
import { useBenchmarkCategories, useBenchmark } from "@/lib/hooks";
import { DataTable, type Column } from "@/components/DataTable";
import type { BenchmarkEntry } from "@/lib/api";

const columns: Column<BenchmarkEntry>[] = [
  {
    key: "rank",
    header: "#",
    render: (row) => (
      <span
        className={`font-bold ${row.rank <= 3 ? "text-yellow-400" : "text-gray-400"}`}
      >
        {row.rank}
      </span>
    ),
  },
  {
    key: "agent_name",
    header: "Agent",
    render: (row) => (
      <div>
        <span className="font-medium text-white">
          {row.agent_name || row.agent_string_id}
        </span>
        <p className="text-xs text-gray-500">{row.agent_string_id}</p>
      </div>
    ),
  },
  {
    key: "score",
    header: "Score",
    render: (row) => (
      <span className="font-semibold text-blue-400">
        {row.score.toFixed(1)}
      </span>
    ),
  },
  {
    key: "total_requests",
    header: "Requests",
    render: (row) => row.total_requests.toLocaleString(),
  },
  {
    key: "avg_response_ms",
    header: "Avg Latency",
    render: (row) => `${row.avg_response_ms.toFixed(0)}ms`,
  },
  {
    key: "error_rate",
    header: "Error Rate",
    render: (row) => `${(row.error_rate * 100).toFixed(2)}%`,
  },
  {
    key: "customer_count",
    header: "Customers",
    render: (row) => row.customer_count.toLocaleString(),
  },
  {
    key: "revenue",
    header: "Revenue",
    render: (row) => (row.revenue > 0 ? `$${row.revenue.toFixed(2)}` : "-"),
  },
];

export default function BenchmarkPage() {
  const { data: categoriesData } = useBenchmarkCategories();
  const [selectedCategory, setSelectedCategory] = useState("");

  const activeCategory =
    selectedCategory || (categoriesData?.categories?.[0] ?? "");
  const { data: benchmarkData, loading } = useBenchmark(activeCategory);

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Benchmark Rankings</h2>

      <div className="mb-6">
        <div className="flex gap-2 flex-wrap">
          {(categoriesData?.categories || []).map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                activeCategory === cat
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <>
          {activeCategory && (
            <h3 className="text-lg font-semibold mb-3">
              Category:{" "}
              <span className="text-blue-400">{activeCategory}</span>
              {benchmarkData && (
                <span className="text-sm text-gray-500 ml-2">
                  ({benchmarkData.total} agents)
                </span>
              )}
            </h3>
          )}
          <DataTable
            columns={columns}
            data={benchmarkData?.rankings || []}
            emptyMessage={
              activeCategory
                ? "No benchmark data for this category"
                : "Select a category to view rankings"
            }
          />
        </>
      )}
    </div>
  );
}
