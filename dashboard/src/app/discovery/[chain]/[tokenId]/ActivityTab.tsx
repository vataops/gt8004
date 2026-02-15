"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { useOnChainActivity } from "@/lib/hooks";
import { NETWORKS } from "@/lib/networks";
import type { EtherscanTx } from "@/lib/etherscan";

// chainId → block explorer base URL
const CHAIN_ID_TO_EXPLORER: Record<number, string> = {};
for (const cfg of Object.values(NETWORKS)) {
  CHAIN_ID_TO_EXPLORER[cfg.chainId] = cfg.blockExplorer;
}

const PAGE_SIZE = 25;

const tooltipStyle = {
  backgroundColor: "#111827",
  border: "1px solid #1F2937",
  borderRadius: "8px",
  fontSize: 12,
  boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
};

export function ActivityTab({
  chainId,
  ownerAddress,
}: {
  chainId: number;
  ownerAddress: string;
}) {
  const { data, loading, error, refresh } = useOnChainActivity(
    chainId,
    ownerAddress,
  );
  const [page, setPage] = useState(1);
  const explorer = CHAIN_ID_TO_EXPLORER[chainId] || "";

  // ── Loading ──
  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-24 bg-gray-800/50 rounded-lg animate-pulse"
            />
          ))}
        </div>
        <div className="h-64 bg-gray-800/50 rounded-lg animate-pulse" />
        <div className="h-48 bg-gray-800/50 rounded-lg animate-pulse" />
      </div>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-lg py-12 text-center">
        <p className="text-gray-400">Unable to load on-chain activity</p>
        <p className="text-sm text-gray-600 mt-1">{error.message}</p>
        <button
          onClick={refresh}
          className="text-xs text-blue-400 hover:text-blue-300 mt-3"
        >
          Retry
        </button>
      </div>
    );
  }

  // ── Balance only (no tx data — API key missing) ──
  if (data && data.totalTxCount === 0 && data.balance !== "0.0") {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="ETH Balance" value={fmtEth(data.balance)} color="blue" />
          <KpiCard label="Transactions" value="—" sub="API key required" color="green" />
          <KpiCard label="Gas Spent" value="—" color="amber" />
          <KpiCard label="Failed Txs" value="—" color="amber" />
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg py-10 text-center">
          <p className="text-gray-400 font-medium">
            Transaction history requires an API key
          </p>
          <p className="text-sm text-gray-600 mt-1">
            Set <code className="text-gray-400 bg-gray-800 px-1.5 py-0.5 rounded text-xs">NEXT_PUBLIC_ETHERSCAN_API_KEY</code> to enable full activity data.
          </p>
          {explorer && (
            <a
              href={`${explorer}/address/${ownerAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:text-blue-300 mt-3 inline-block"
            >
              View on Explorer &rarr;
            </a>
          )}
        </div>
      </div>
    );
  }

  // ── Empty (genuinely no activity) ──
  if (!data || (data.totalTxCount === 0 && data.balance === "0.0")) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-lg py-16 text-center">
        <p className="text-gray-400 font-medium">No on-chain activity</p>
        <p className="text-sm text-gray-600 mt-1">
          This wallet has no transactions on this network yet.
        </p>
        {explorer && (
          <a
            href={`${explorer}/address/${ownerAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-400 hover:text-blue-300 mt-3 inline-block"
          >
            View on Explorer &rarr;
          </a>
        )}
      </div>
    );
  }

  // ── Data ready ──
  const { transactions, dailyActivity } = data;
  const totalPages = Math.ceil(transactions.length / PAGE_SIZE);
  const pageTxs = transactions.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  const chartData = dailyActivity.map((d) => ({
    date: new Date(d.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    transactions: d.count,
    gas: +d.gasSpent.toFixed(6),
  }));

  return (
    <div className="space-y-6">
      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="ETH Balance" value={fmtEth(data.balance)} color="blue" />
        <KpiCard
          label="Transactions"
          value={String(data.totalTxCount)}
          sub={data.totalTxCount >= 200 ? "200+ (latest shown)" : undefined}
          color="green"
        />
        <KpiCard
          label="Gas Spent"
          value={`${fmtEth(data.totalGasSpentEth)} ETH`}
          color="amber"
        />
        <KpiCard
          label="Failed Txs"
          value={String(data.errorCount)}
          sub={
            data.totalTxCount > 0
              ? `${((data.errorCount / data.totalTxCount) * 100).toFixed(1)}%`
              : undefined
          }
          color={data.errorCount > 0 ? "amber" : "green"}
        />
      </div>

      {/* ── Value Summary ── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">Total Sent</p>
          <p className="text-lg font-bold text-gray-100">
            {fmtEth(data.totalValueSentEth)} ETH
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">Total Received</p>
          <p className="text-lg font-bold text-green-400">
            {fmtEth(data.totalValueReceivedEth)} ETH
          </p>
        </div>
      </div>

      {/* ── Daily Activity Chart ── */}
      {chartData.length > 1 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
          <h3 className="text-sm font-medium text-gray-400 mb-4">
            Daily Transaction Activity
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "#6B7280" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#6B7280" }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar
                dataKey="transactions"
                fill="#3B82F6"
                radius={[4, 4, 0, 0]}
                name="Transactions"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Transaction History ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
          <h3 className="text-sm font-medium text-gray-400">
            Recent Transactions
          </h3>
          {explorer && (
            <a
              href={`${explorer}/address/${ownerAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              View all on Explorer &rarr;
            </a>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500 text-xs">
                <th className="text-left px-4 py-2.5">Tx Hash</th>
                <th className="text-left px-4 py-2.5">Method</th>
                <th className="text-left px-4 py-2.5">Direction</th>
                <th className="text-right px-4 py-2.5">Value (ETH)</th>
                <th className="text-right px-4 py-2.5">Gas Fee</th>
                <th className="text-right px-4 py-2.5">Age</th>
                <th className="text-center px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {pageTxs.map((tx) => (
                <TxRow
                  key={tx.hash}
                  tx={tx}
                  ownerAddress={ownerAddress}
                  explorer={explorer}
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
            <span className="text-xs text-gray-500">
              {(page - 1) * PAGE_SIZE + 1}–
              {Math.min(page * PAGE_SIZE, transactions.length)} of{" "}
              {transactions.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-2 py-1 rounded text-xs text-gray-400 hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-2 py-1 rounded text-xs text-gray-400 hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helper Components ──

function KpiCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color: "blue" | "green" | "amber";
}) {
  const colorMap = {
    blue: "bg-blue-900/20 border-blue-800/40 text-blue-400",
    green: "bg-green-900/20 border-green-800/40 text-green-400",
    amber: "bg-amber-900/20 border-amber-800/40 text-amber-400",
  };
  return (
    <div className={`rounded-lg border p-4 ${colorMap[color]}`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-lg font-bold">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function TxRow({
  tx,
  ownerAddress,
  explorer,
}: {
  tx: EtherscanTx;
  ownerAddress: string;
  explorer: string;
}) {
  const addr = ownerAddress.toLowerCase();
  const isOutgoing = tx.from.toLowerCase() === addr;
  const isSelf =
    tx.from.toLowerCase() === addr &&
    (tx.to || "").toLowerCase() === addr;
  const value = BigInt(tx.value || "0");
  const gasFee = BigInt(tx.gasUsed || "0") * BigInt(tx.gasPrice || "0");
  const isFailed = tx.isError === "1";
  const method = parseMethod(tx.functionName);

  const counterparty = isSelf
    ? "Self"
    : isOutgoing
      ? truncAddr(tx.to || tx.contractAddress || "")
      : truncAddr(tx.from);

  return (
    <tr className="border-b border-gray-800/50 hover:bg-gray-800/20">
      {/* Tx Hash */}
      <td className="px-4 py-2.5">
        {explorer ? (
          <a
            href={`${explorer}/tx/${tx.hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-xs text-blue-400 hover:text-blue-300"
          >
            {truncAddr(tx.hash)}
          </a>
        ) : (
          <span className="font-mono text-xs text-gray-400">
            {truncAddr(tx.hash)}
          </span>
        )}
      </td>

      {/* Method */}
      <td className="px-4 py-2.5">
        <span className="text-xs text-gray-400 bg-gray-800 px-1.5 py-0.5 rounded font-mono">
          {method}
        </span>
      </td>

      {/* Direction */}
      <td className="px-4 py-2.5">
        <span
          className={`text-xs font-medium ${
            isSelf
              ? "text-gray-400"
              : isOutgoing
                ? "text-amber-400"
                : "text-green-400"
          }`}
        >
          {isSelf ? "SELF" : isOutgoing ? "OUT" : "IN"}
        </span>
        <span className="text-xs text-gray-600 ml-1.5">{counterparty}</span>
      </td>

      {/* Value */}
      <td className="px-4 py-2.5 text-right">
        <span
          className={`font-mono text-xs ${
            value === BigInt(0)
              ? "text-gray-600"
              : isOutgoing
                ? "text-gray-300"
                : "text-green-400"
          }`}
        >
          {value === BigInt(0) ? "0" : fmtEth(formatWei(value))}
        </span>
      </td>

      {/* Gas Fee */}
      <td className="px-4 py-2.5 text-right">
        <span className="font-mono text-xs text-gray-500">
          {fmtEth(formatWei(gasFee))}
        </span>
      </td>

      {/* Age */}
      <td className="px-4 py-2.5 text-right">
        <span className="text-xs text-gray-500">
          {timeAgo(Number(tx.timeStamp) * 1000)}
        </span>
      </td>

      {/* Status */}
      <td className="px-4 py-2.5 text-center">
        <span
          className={`inline-block w-2 h-2 rounded-full ${
            isFailed ? "bg-red-400" : "bg-green-400"
          }`}
          title={isFailed ? "Failed" : "Success"}
        />
      </td>
    </tr>
  );
}

// ── Utilities ──

function truncAddr(addr: string): string {
  if (!addr || addr.length < 12) return addr || "—";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function parseMethod(fn: string): string {
  if (!fn) return "transfer";
  const match = fn.match(/^(\w+)\(/);
  return match ? match[1] : fn.slice(0, 10);
}

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/** Format wei bigint to ETH string */
function formatWei(wei: bigint): string {
  const str = wei.toString();
  if (str.length <= 18) {
    return `0.${"0".repeat(18 - str.length)}${str}`;
  }
  const whole = str.slice(0, str.length - 18);
  const frac = str.slice(str.length - 18);
  return `${whole}.${frac}`;
}

/** Trim trailing zeros and cap to 6 decimals for display */
function fmtEth(val: string): string {
  const n = parseFloat(val);
  if (n === 0) return "0";
  if (n >= 1) return n.toFixed(4);
  if (n >= 0.0001) return n.toFixed(6);
  return n.toExponential(2);
}
