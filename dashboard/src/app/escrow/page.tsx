"use client";

import { useEscrow } from "@/lib/hooks";

export default function EscrowPage() {
  const { data: escrow, loading } = useEscrow();

  if (loading) return <p className="text-gray-500">Loading...</p>;
  if (!escrow) return <p className="text-red-400">Failed to load escrow data</p>;

  const ratio =
    escrow.total_usdc_deposited > 0
      ? escrow.total_credits_in_circulation / escrow.total_usdc_deposited
      : 0;
  const ratioOk = Math.abs(ratio - 1000) < 1 || escrow.total_usdc_deposited === 0;

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Escrow Status</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500">USDC Deposited</p>
          <p className="text-2xl font-bold mt-1">
            ${escrow.total_usdc_deposited.toFixed(2)}
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500">CREDIT in Circulation</p>
          <p className="text-2xl font-bold mt-1">
            {escrow.total_credits_in_circulation.toLocaleString()}
          </p>
        </div>
        <div
          className={`bg-gray-900 border rounded-lg p-4 ${ratioOk ? "border-green-800" : "border-red-800"}`}
        >
          <p className="text-xs text-gray-500">CREDIT/USDC Ratio</p>
          <p
            className={`text-2xl font-bold mt-1 ${ratioOk ? "text-green-400" : "text-red-400"}`}
          >
            {escrow.total_usdc_deposited > 0
              ? `1:${ratio.toFixed(0)}`
              : "N/A"}
          </p>
          <p className="text-xs mt-1 text-gray-500">Expected: 1:1000</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500">Channels</p>
          <p className="text-lg font-bold mt-1">
            {escrow.active_channels} active / {escrow.settled_channels} settled
          </p>
        </div>
      </div>
    </div>
  );
}
