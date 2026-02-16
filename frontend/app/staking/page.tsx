"use client";

import { useState } from "react";

// Realistic staking data for demo
// HYDRO price: $0.85 per token
const HYDRO_PRICE = 0.85;

const DUMMY_DATA = {
  totalStaked: 2_450_000,           // 2.45M HYDRO staked (28.8% of supply)
  circulatingSupply: 8_500_000,     // 8.5M HYDRO circulating
  totalRewardsDistributed: 187_500,  // Total rewards distributed since launch
  userStaked: 125_000,               // User's stake: 125k HYDRO (≈ 5.1% of total staked)
  userRewards: 12_850,               // User's total earned rewards in HYDRO
  userRewardsUSD: 12_850 * HYDRO_PRICE, // User's total earned rewards in USD
  stakingAPR: 18.5,                  // Current APR based on recent performance
  // Epoch rewards showing realistic earning pattern over 12 weeks
  // Each epoch = 1 week, showing growth then stabilization
  // Values in USD (converted from HYDRO at $0.85)
  // isClaimed: whether this epoch's reward has been claimed
  epochRewards: [
    { epoch: 1, reward: 680 * HYDRO_PRICE, timestamp: "Week 1", isClaimed: true },      // Start
    { epoch: 2, reward: 750 * HYDRO_PRICE, timestamp: "Week 2", isClaimed: true },      // Up
    { epoch: 3, reward: 820 * HYDRO_PRICE, timestamp: "Week 3", isClaimed: true },      // Up
    { epoch: 4, reward: 780 * HYDRO_PRICE, timestamp: "Week 4", isClaimed: true },      // Dip
    { epoch: 5, reward: 850 * HYDRO_PRICE, timestamp: "Week 5", isClaimed: true },      // Recovery
    { epoch: 6, reward: 920 * HYDRO_PRICE, timestamp: "Week 6", isClaimed: true },      // Up
    { epoch: 7, reward: 990 * HYDRO_PRICE, timestamp: "Week 7", isClaimed: true },      // Up
    { epoch: 8, reward: 1_060 * HYDRO_PRICE, timestamp: "Week 8", isClaimed: false },   // Claimable start
    { epoch: 9, reward: 1_140 * HYDRO_PRICE, timestamp: "Week 9", isClaimed: false },   // Up
    { epoch: 10, reward: 1_220 * HYDRO_PRICE, timestamp: "Week 10", isClaimed: false }, // Up
    { epoch: 11, reward: 1_310 * HYDRO_PRICE, timestamp: "Week 11", isClaimed: false }, // Up
    { epoch: 12, reward: 1_400 * HYDRO_PRICE, timestamp: "Week 12", isClaimed: false }, // Peak (current)
  ] as { epoch: number; reward: number; timestamp: string; isClaimed: boolean }[],
};

export default function StakingPage() {
  const [stakeAmount, setStakeAmount] = useState("");
  const [activeTab, setActiveTab] = useState<"stake" | "unstake">("stake");

  const stakingRatio = (DUMMY_DATA.totalStaked / DUMMY_DATA.circulatingSupply) * 100;
  const maxReward = Math.max(...DUMMY_DATA.epochRewards.map((e) => e.reward));

  // Calculate claimable amount (only from unclaimed epochs)
  const claimableUSD = DUMMY_DATA.epochRewards
    .filter(epoch => !epoch.isClaimed)
    .reduce((sum, epoch) => sum + epoch.reward, 0);

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("en-US").format(num);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6 overflow-y-auto" style={{ touchAction: "auto", WebkitTouchCallout: "none" }}>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">HYDRO Staking</h1>
          <p className="text-zinc-400">
            Stake HYDRO tokens to earn a share of protocol revenue. Rewards are distributed every epoch based on your staking share.
          </p>
        </div>

        {/* Global Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Total Staked */}
          <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-[#00FFE0]/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-[#00FFE0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-zinc-400 text-sm">Total Staked</span>
            </div>
            <p className="text-2xl font-bold text-white">{formatNumber(DUMMY_DATA.totalStaked)} <span className="text-sm font-normal text-[#00FFE0]">HYDRO</span></p>
            <p className="text-xs text-zinc-500 mt-1">≈ ${formatNumber(DUMMY_DATA.totalStaked * 0.85)} USD</p>
          </div>

          {/* Staking Ratio */}
          <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-[#00FFE0]/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-[#00FFE0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                </svg>
              </div>
              <span className="text-zinc-400 text-sm">Staking Ratio</span>
            </div>
            <p className="text-2xl font-bold text-white">{stakingRatio.toFixed(2)}<span className="text-sm font-normal text-zinc-400">%</span></p>
            <div className="mt-2 h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#00FFE0] to-[#00FFE0]/50 rounded-full"
                style={{ width: `${stakingRatio}%` }}
              />
            </div>
          </div>

          {/* Total Rewards Distributed */}
          <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-[#00FFE0]/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-[#00FFE0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                </svg>
              </div>
              <span className="text-zinc-400 text-sm">Total Rewards Distributed</span>
            </div>
            <p className="text-2xl font-bold text-white">{formatNumber(DUMMY_DATA.totalRewardsDistributed)} <span className="text-sm font-normal text-[#00FFE0]">HYDRO</span></p>
            <p className="text-xs text-zinc-500 mt-1">Since protocol launch</p>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Staking Panel */}
          <div className="lg:col-span-1 bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">Stake HYDRO</h2>

            {/* Tabs */}
            <div className="flex bg-[#1a1a1a] rounded-lg p-1 mb-6">
              <button
                onClick={() => setActiveTab("stake")}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                  activeTab === "stake"
                    ? "bg-[#00FFE0] text-black"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Stake
              </button>
              <button
                onClick={() => setActiveTab("unstake")}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                  activeTab === "unstake"
                    ? "bg-[#00FFE0] text-black"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Unstake
              </button>
            </div>

            {/* Input */}
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-zinc-400">Amount</span>
                  <span className="text-zinc-500">Available: <span className="text-[#00FFE0]">{formatNumber(350_000)}</span> HYDRO</span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={stakeAmount}
                    onChange={(e) => setStakeAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-[#141414] border border-[#2a2a2a] rounded-lg px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-[#00FFE0]/50 transition-colors"
                  />
                  <button
                    onClick={() => setStakeAmount("0")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#00FFE0] hover:text-[#00FFE0]/80 transition-colors"
                  >
                    MAX
                  </button>
                </div>
              </div>

              {/* APR Display */}
              <div className="bg-[#141414] border border-[#1f1f1f] rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400 text-sm">Current APR</span>
                  <span className="text-[#00FFE0] font-bold text-lg">{DUMMY_DATA.stakingAPR}%</span>
                </div>
                <p className="text-xs text-zinc-500 mt-1">Based on last 30 days performance</p>
              </div>

              {/* Action Button */}
              <button className="w-full py-3 bg-[#00FFE0] text-black font-semibold rounded-lg hover:bg-[#00FFE0]/90 transition-colors shadow-[0_0_20px_rgba(0,255,224,0.2)]">
                {activeTab === "stake" ? "Stake HYDRO" : "Unstake HYDRO"}
              </button>

              <p className="text-xs text-zinc-500 text-center">
                {activeTab === "stake"
                  ? "Staked tokens are locked for the current epoch"
                  : "Unstaking takes effect at the next epoch boundary"
                }
              </p>
            </div>
          </div>

          {/* Your Position & Rewards */}
          <div className="lg:col-span-2 space-y-6">
            {/* Your Position */}
            <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4">Your Position</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-[#141414] border border-[#1f1f1f] rounded-lg p-4">
                  <p className="text-zinc-400 text-xs mb-1">Staked Amount</p>
                  <p className="text-xl font-bold text-white">{formatNumber(DUMMY_DATA.userStaked)}</p>
                  <p className="text-xs text-[#00FFE0]">HYDRO</p>
                </div>
                <div className="bg-[#141414] border border-[#1f1f1f] rounded-lg p-4">
                  <p className="text-zinc-400 text-xs mb-1">Your Share</p>
                  <p className="text-xl font-bold text-white">{((DUMMY_DATA.userStaked / DUMMY_DATA.totalStaked) * 100).toFixed(3)}%</p>
                  <p className="text-xs text-zinc-500">of total</p>
                </div>
                <div className="bg-[#141414] border border-[#1f1f1f] rounded-lg p-4">
                  <p className="text-zinc-400 text-xs mb-1">Total Earned</p>
                  <p className="text-xl font-bold text-white">${formatNumber(Math.round(DUMMY_DATA.userRewardsUSD))}</p>
                  <p className="text-xs text-zinc-500">USD Stablecoin</p>
                </div>
                <div className="bg-[#141414] border border-[#1f1f1f] rounded-lg p-4">
                  <p className="text-zinc-400 text-xs mb-1">USD Value</p>
                  <p className="text-xl font-bold text-white">${formatNumber(DUMMY_DATA.userStaked * 0.85)}</p>
                  <p className="text-xs text-zinc-500">@ $0.85</p>
                </div>
              </div>
            </div>

            {/* Rewards Chart */}
            <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold">Epoch Rewards</h2>
                  <p className="text-zinc-500 text-sm">Your rewards per epoch</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-zinc-400">Claimable</p>
                  <p className="text-xl font-bold text-[#00FFE0]">${formatNumber(Math.round(claimableUSD))}</p>
                </div>
              </div>

              {/* Bar Chart */}
              <div className="mb-6">
                {/* Chart wrapper with relative positioning */}
                <div className="relative" style={{ height: "300px" }}>
                  {/* Labels positioned absolutely at top of each bar */}
                  <div className="absolute top-0 left-0 right-0 flex justify-between gap-1 px-1" style={{ height: "300px" }}>
                    {DUMMY_DATA.epochRewards.map((epoch) => {
                      const heightPercent = (epoch.reward / maxReward) * 100;
                      // Label position from bottom = bar height + small gap
                      const labelBottom = (260 * heightPercent / 100) + 4;
                      return (
                        <div key={`label-${epoch.epoch}`} className="flex-1 relative">
                          <div
                            className="absolute left-1/2 -translate-x-1/2 text-xs text-zinc-400 font-semibold whitespace-nowrap"
                            style={{ bottom: `${labelBottom}px` }}
                          >
                            ${formatNumber(Math.round(epoch.reward))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Bars container - 260px for bars, leaving room for labels */}
                  <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between gap-1 px-1" style={{ height: "260px" }}>
                    {DUMMY_DATA.epochRewards.map((epoch) => {
                      const heightPercent = (epoch.reward / maxReward) * 100;
                      const isClaimed = epoch.isClaimed;
                      return (
                        <div
                          key={epoch.epoch}
                          className={`flex-1 rounded-t-lg transition-all cursor-pointer ${
                            isClaimed
                              ? "bg-gradient-to-t from-[#00FFE0]/30 to-[#00FFE0]/10 hover:from-[#00FFE0]/50 hover:to-[#00FFE0]/20 opacity-60"
                              : "bg-gradient-to-t from-[#00FFE0] to-[#00FFE0]/40 hover:from-[#00FFE0] hover:to-[#00FFE0]/60 hover:shadow-lg hover:shadow-[#00FFE0]/30"
                          }`}
                          style={{ height: `${heightPercent}%` }}
                          title={`Epoch ${epoch.epoch}: $${formatNumber(Math.round(epoch.reward))} ${isClaimed ? "(Claimed)" : "(Claimable)"}`}
                        />
                      );
                    })}
                  </div>
                </div>
                {/* Checkmarks row */}
                <div className="w-full flex justify-between gap-1 px-1 mt-1">
                  {DUMMY_DATA.epochRewards.map((epoch) => (
                    <div key={`check-${epoch.epoch}`} className="flex-1 text-center h-4">
                      {epoch.isClaimed && <span className="text-xs text-zinc-500">✓</span>}
                    </div>
                  ))}
                </div>
                {/* Labels row */}
                <div className="flex justify-between gap-1 px-1">
                  {DUMMY_DATA.epochRewards.map((epoch) => (
                    <div key={`label-${epoch.epoch}`} className="flex-1 text-center">
                      <div className="text-xs text-zinc-500 whitespace-nowrap">Epoch {epoch.epoch}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Claim Button */}
              <button className="w-full py-3 bg-[#141414] border border-[#00FFE0]/30 text-[#00FFE0] font-semibold rounded-lg hover:bg-[#00FFE0]/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled={claimableUSD === 0}>
                {claimableUSD > 0 ? `Claim $${formatNumber(Math.round(claimableUSD))} Rewards` : "No Rewards to Claim"}
              </button>
            </div>
          </div>
        </div>

        {/* Info Section */}
        <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">How Staking Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-[#00FFE0]/10 flex items-center justify-center shrink-0">
                <span className="text-[#00FFE0] font-bold">1</span>
              </div>
              <div>
                <h3 className="font-medium text-white mb-1">Stake HYDRO</h3>
                <p className="text-sm text-zinc-400">Deposit your HYDRO tokens into the staking contract. Your stake becomes active at the next epoch.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-[#00FFE0]/10 flex items-center justify-center shrink-0">
                <span className="text-[#00FFE0] font-bold">2</span>
              </div>
              <div>
                <h3 className="font-medium text-white mb-1">Earn Rewards</h3>
                <p className="text-sm text-zinc-400">50% of protocol fees are distributed to stakers proportionally based on their share.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-[#00FFE0]/10 flex items-center justify-center shrink-0">
                <span className="text-[#00FFE0] font-bold">3</span>
              </div>
              <div>
                <h3 className="font-medium text-white mb-1">Claim Anytime</h3>
                <p className="text-sm text-zinc-400">Rewards accumulate each epoch and can be claimed at any time with no lockup period.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
