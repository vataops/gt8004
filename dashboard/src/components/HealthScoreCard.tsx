export function HealthScoreCard({
  score,
  status,
  delta,
}: {
  score: number;
  status: string;
  delta: number;
}) {
  const statusColor =
    status === "Excellent" ? "text-green-400" :
    status === "Good" ? "text-yellow-400" :
    status === "Fair" ? "text-orange-400" :
    "text-red-400";

  const statusBgColor =
    status === "Excellent" ? "bg-green-500/10 border-green-500/20" :
    status === "Good" ? "bg-yellow-500/10 border-yellow-500/20" :
    status === "Fair" ? "bg-orange-500/10 border-orange-500/20" :
    "bg-red-500/10 border-red-500/20";

  const progressColor =
    status === "Excellent" ? "bg-green-500" :
    status === "Good" ? "bg-yellow-500" :
    status === "Fair" ? "bg-orange-500" :
    "bg-red-500";

  return (
    <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium text-zinc-400 mb-1">Health Score</h3>
          <div className="flex items-baseline gap-2">
            <span className={`text-4xl font-bold ${statusColor}`}>
              {score.toFixed(0)}
            </span>
            <span className="text-zinc-500 text-lg">/100</span>
          </div>
        </div>
        <div className={`px-3 py-1.5 rounded-lg border ${statusBgColor}`}>
          <span className={`text-sm font-medium ${statusColor}`}>{status}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="w-full h-3 bg-[#141414] rounded-full overflow-hidden">
          <div
            className={`h-full ${progressColor} transition-all duration-500`}
            style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
          />
        </div>
      </div>

      {/* Delta indicator */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-zinc-500">24h Change:</span>
        {delta === 0 ? (
          <span className="text-zinc-400">No change</span>
        ) : (
          <span className={delta > 0 ? "text-green-400" : "text-red-400"}>
            {delta > 0 ? "↑" : "↓"} {Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}
