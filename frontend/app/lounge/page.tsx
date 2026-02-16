"use client";

import { useState } from "react";
import Link from "next/link";
import Chart from "@/components/Chart";

// ============ DUMMY DATA ============

// Top traders with 30-day PnL rankings
const DUMMY_TRADERS = [
  {
    id: "1",
    username: "WhaleHunter",
    walletAddress: "addr1qx8...3f2k",
    pnl30d: 284520.45,
    pnlPercent30d: 142.3,
    winRate: 78.5,
    totalTrades: 342,
    followers: 12450,
    isVerified: true,
    hasNFT: true,
    rank: 1,
  },
  {
    id: "2",
    username: "CryptoSamurai",
    walletAddress: "addr1qy7...8k2m",
    pnl30d: 156780.32,
    pnlPercent30d: 89.7,
    winRate: 72.3,
    totalTrades: 521,
    followers: 8920,
    isVerified: true,
    hasNFT: true,
    rank: 2,
  },
  {
    id: "3",
    username: "AlphaTrader",
    walletAddress: "addr1qz3...9p4n",
    pnl30d: 98450.18,
    pnlPercent30d: 67.2,
    winRate: 69.8,
    totalTrades: 289,
    followers: 6340,
    isVerified: false,
    hasNFT: true,
    rank: 3,
  },
  {
    id: "4",
    username: "DeFiWizard",
    walletAddress: "addr1qw2...1x5r",
    pnl30d: 72340.90,
    pnlPercent30d: 54.8,
    winRate: 65.4,
    totalTrades: 178,
    followers: 4250,
    isVerified: true,
    hasNFT: false,
    rank: 4,
  },
  {
    id: "5",
    username: "MoonBoy99",
    walletAddress: "addr1qv8...7y6t",
    pnl30d: 45670.25,
    pnlPercent30d: 38.9,
    winRate: 61.2,
    totalTrades: 456,
    followers: 3120,
    isVerified: false,
    hasNFT: true,
    rank: 5,
  },
];

// Trending/Featured traders
const FEATURED_TRADERS = [
  {
    id: "adamaxi",
    username: "ADAMaximalist",
    tagline: "Cardano believer. Building the future.",
    followers: 15200,
    recentPnl: 42350.80,
    isHot: true,
  },
  {
    id: "f2",
    username: "ETHQueen",
    tagline: "Riding the merge to the moon",
    followers: 9800,
    recentPnl: 28900.45,
    isHot: true,
  },
  {
    id: "f3",
    username: "LeverageKing",
    tagline: "100x or nothing",
    followers: 7650,
    recentPnl: 18450.30,
    isHot: false,
  },
];

// Timeline posts
const DUMMY_POSTS = [
  {
    id: "p1",
    trader: {
      id: "1",
      username: "WhaleHunter",
      isVerified: true,
    },
    content: "Just closed a massive BTC long at $95.2K. Called this move 3 days ago! Check my chart analysis below.",
    chartImage: "/charts/btc-analysis.png",
    position: {
      symbol: "BTC_USD",
      side: "Long",
      entry: 91250,
      exit: 95200,
      pnl: 12450.80,
      leverage: 10,
    },
    likes: 342,
    comments: 56,
    shares: 89,
    timestamp: "2h ago",
    isFromTwitter: false,
    isPremium: false,
  },
  {
    id: "p2",
    trader: {
      id: "adamaxi",
      username: "ADAMaximalist",
      isVerified: true,
    },
    content: "ADA showing strength at $0.45 support. Loading up for the next leg up. Cardano ecosystem is growing fast!",
    chartImage: null,
    position: {
      symbol: "ADA_USD",
      side: "Long",
      entry: 0.45,
      exit: null,
      pnl: 2340.50,
      leverage: 5,
    },
    likes: 189,
    comments: 34,
    shares: 42,
    timestamp: "4h ago",
    isFromTwitter: true,
    isPremium: false,
  },
  {
    id: "p3",
    trader: {
      id: "3",
      username: "AlphaTrader",
      isVerified: false,
    },
    content: "Premium subscribers only: My next big play is loading. Join the alpha group for early access.",
    chartImage: null,
    position: null,
    likes: 567,
    comments: 123,
    shares: 34,
    timestamp: "6h ago",
    isFromTwitter: false,
    isPremium: true,
  },
  {
    id: "p4",
    trader: {
      id: "4",
      username: "DeFiWizard",
      isVerified: true,
    },
    content: "SOL looking weak here. Shorting with tight stop loss above $180. Risk management is key!",
    chartImage: "/charts/sol-analysis.png",
    position: {
      symbol: "SOL_USD",
      side: "Short",
      entry: 175.50,
      exit: null,
      pnl: -120.30,
      leverage: 3,
    },
    likes: 98,
    comments: 45,
    shares: 12,
    timestamp: "8h ago",
    isFromTwitter: true,
    isPremium: false,
  },
  {
    id: "p5",
    trader: {
      id: "5",
      username: "MoonBoy99",
      isVerified: false,
    },
    content: "DOGE to $1 is not a meme! Loading up on this dip. Diamond hands only!",
    chartImage: null,
    position: {
      symbol: "DOGE_USD",
      side: "Long",
      entry: 0.32,
      exit: null,
      pnl: 890.20,
      leverage: 2,
    },
    likes: 1245,
    comments: 234,
    shares: 156,
    timestamp: "12h ago",
    isFromTwitter: false,
    isPremium: false,
  },
];

// ============ ICONS ============

const SearchIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const VerifiedIcon = () => (
  <svg className="w-4 h-4 text-[#00FFE0]" fill="currentColor" viewBox="0 0 24 24">
    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const HeartIcon = ({ filled }: { filled?: boolean }) => (
  <svg className="w-5 h-5" fill={filled ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
  </svg>
);

const CommentIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
);

const ShareIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
  </svg>
);

const TwitterIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const FireIcon = () => (
  <svg className="w-4 h-4 text-orange-500" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 23c-4.97 0-9-3.58-9-8 0-2.52 1.17-5.06 3.19-6.94.97-.9 1.81-1.88 2.47-2.91.28-.44.9-.44 1.18 0 .66 1.03 1.5 2.01 2.47 2.91C14.33 9.94 15.5 12.48 15.5 15c0 1.93-.78 3.68-2.05 4.95A6.94 6.94 0 0112 23z" />
  </svg>
);

const CrownIcon = () => (
  <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
    <path d="M2.5 19h19v2h-19v-2zm19.57-9.36c-.21-.8-1.04-1.28-1.84-1.06l-4.23 1.06-3.53-5.94a1.48 1.48 0 00-2.54 0L6.4 9.64l-4.23-1.06a1.49 1.49 0 00-1.84 1.06 1.49 1.49 0 00.41 1.46L4.5 15h15l3.76-3.9c.43-.44.57-1.08.31-1.46z" />
  </svg>
);

const LockIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);

const NFTBadgeIcon = () => (
  <svg className="w-4 h-4 text-purple-400" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
  </svg>
);

// ============ COMPONENTS ============

// Trader Avatar Component
const TraderAvatar = ({ username, size = "md" }: { username: string; size?: "sm" | "md" | "lg" }) => {
  const sizeClasses = {
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-12 h-12 text-base",
  };

  const colors = [
    "from-[#00FFE0] to-cyan-600",
    "from-purple-500 to-pink-500",
    "from-orange-500 to-red-500",
    "from-green-500 to-emerald-600",
    "from-blue-500 to-indigo-600",
  ];

  const colorIndex = username.charCodeAt(0) % colors.length;

  return (
    <div className={`${sizeClasses[size]} rounded-full bg-gradient-to-br ${colors[colorIndex]} flex items-center justify-center font-bold text-white`}>
      {username.charAt(0).toUpperCase()}
    </div>
  );
};

// Leaderboard Row Component
const LeaderboardRow = ({ trader }: { trader: typeof DUMMY_TRADERS[0] }) => {
  const getRankBadge = (rank: number) => {
    if (rank === 1) return <CrownIcon />;
    if (rank === 2) return <span className="text-gray-400 font-bold">2</span>;
    if (rank === 3) return <span className="text-amber-700 font-bold">3</span>;
    return <span className="text-zinc-500 font-mono">{rank}</span>;
  };

  return (
    <Link href={`/lounge/trader/${trader.id}`}>
      <div className="flex items-center gap-4 p-4 bg-[#0f0f0f] hover:bg-[#1a1a1a] border border-[#1a1a1a] rounded-lg transition-all cursor-pointer group">
        {/* Rank */}
        <div className="w-8 flex justify-center">
          {getRankBadge(trader.rank)}
        </div>

        {/* Avatar & Name */}
        <div className="flex items-center gap-3 flex-1">
          <TraderAvatar username={trader.username} size="md" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-white group-hover:text-[#00FFE0] transition-colors">
                {trader.username}
              </span>
              {trader.isVerified && <VerifiedIcon />}
              {trader.hasNFT && <NFTBadgeIcon />}
            </div>
            <span className="text-xs text-zinc-500">{trader.walletAddress}</span>
          </div>
        </div>

        {/* Stats */}
        <div className="hidden md:flex items-center gap-6">
          <div className="text-center">
            <div className="text-xs text-zinc-500">Win Rate</div>
            <div className="text-sm font-medium text-white">{trader.winRate}%</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-zinc-500">Trades</div>
            <div className="text-sm font-medium text-white">{trader.totalTrades}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-zinc-500">Followers</div>
            <div className="text-sm font-medium text-white">{trader.followers.toLocaleString()}</div>
          </div>
        </div>

        {/* 30D PnL */}
        <div className="text-right">
          <div className="text-lg font-bold text-green-500">
            +${trader.pnl30d.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className="text-xs text-green-400">+{trader.pnlPercent30d}%</div>
        </div>
      </div>
    </Link>
  );
};

// Featured Trader Card
const FeaturedTraderCard = ({ trader }: { trader: typeof FEATURED_TRADERS[0] }) => (
  <Link href={`/lounge/trader/${trader.id}`}>
    <div className="p-4 bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl hover:border-[#00FFE0]/30 transition-all cursor-pointer group">
      <div className="flex items-start gap-3">
        <TraderAvatar username={trader.username} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-white group-hover:text-[#00FFE0] transition-colors truncate">
              {trader.username}
            </span>
            {trader.isHot && <FireIcon />}
          </div>
          <p className="text-xs text-zinc-500 truncate mt-0.5">{trader.tagline}</p>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs text-zinc-400">{trader.followers.toLocaleString()} followers</span>
            <span className="text-xs text-green-500">+${trader.recentPnl.toLocaleString()}</span>
          </div>
        </div>
      </div>
      <button className="w-full mt-3 py-2 text-sm font-medium text-[#00FFE0] bg-[#00FFE0]/10 hover:bg-[#00FFE0]/20 border border-[#00FFE0]/30 rounded-lg transition-all">
        Follow
      </button>
    </div>
  </Link>
);

// Post Card Component
const PostCard = ({ post }: { post: typeof DUMMY_POSTS[0] }) => (
  <div className="p-4 bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl">
    {/* Header */}
    <div className="flex items-start gap-3">
      <Link href={`/lounge/trader/${post.trader.id}`}>
        <TraderAvatar username={post.trader.username} size="md" />
      </Link>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <Link href={`/lounge/trader/${post.trader.id}`} className="font-medium text-white hover:text-[#00FFE0] transition-colors">
            {post.trader.username}
          </Link>
          {post.trader.isVerified && <VerifiedIcon />}
          {post.isFromTwitter && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-zinc-800 rounded text-xs text-zinc-400">
              <TwitterIcon />
              <span>via X</span>
            </span>
          )}
          <span className="text-xs text-zinc-500">{post.timestamp}</span>
        </div>

        {/* Content */}
        <p className="mt-2 text-sm text-zinc-300">{post.content}</p>

        {/* Premium Lock */}
        {post.isPremium && (
          <div className="mt-3 p-3 bg-[#1a1a1a] border border-zinc-700 rounded-lg flex items-center gap-2">
            <LockIcon />
            <span className="text-sm text-zinc-400">Subscribe to unlock premium content</span>
          </div>
        )}

        {/* Position Info */}
        {post.position && !post.isPremium && (
          <div className="mt-3 p-3 bg-[#1a1a1a] rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`px-2 py-1 text-xs font-medium rounded ${
                  post.position.side === "Long"
                    ? "bg-green-500/20 text-green-400"
                    : "bg-red-500/20 text-red-400"
                }`}>
                  {post.position.side} {post.position.leverage}x
                </span>
                <span className="text-sm font-medium text-white">{post.position.symbol.replace("_", "/")}</span>
              </div>
              <div className={`text-sm font-bold ${post.position.pnl >= 0 ? "text-green-500" : "text-red-500"}`}>
                {post.position.pnl >= 0 ? "+" : ""}${post.position.pnl.toLocaleString()}
              </div>
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs text-zinc-500">
              <span>Entry: ${post.position.entry.toLocaleString()}</span>
              {post.position.exit && <span>Exit: ${post.position.exit.toLocaleString()}</span>}
            </div>
          </div>
        )}

        {/* Chart */}
        {post.chartImage && !post.isPremium && (
          <div className="mt-3 rounded-lg overflow-hidden border border-zinc-800">
            <div className="h-[200px]">
              <Chart symbol={post.position?.symbol || "BTC_USD"} />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-6 mt-4">
          <button className="flex items-center gap-1.5 text-zinc-500 hover:text-pink-500 transition-colors">
            <HeartIcon />
            <span className="text-sm">{post.likes}</span>
          </button>
          <button className="flex items-center gap-1.5 text-zinc-500 hover:text-[#00FFE0] transition-colors">
            <CommentIcon />
            <span className="text-sm">{post.comments}</span>
          </button>
          <button className="flex items-center gap-1.5 text-zinc-500 hover:text-blue-400 transition-colors">
            <ShareIcon />
            <span className="text-sm">{post.shares}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
);

// ============ MAIN PAGE ============

export default function LoungePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"trending" | "latest" | "following">("trending");

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">
            Lounge
            <span className="ml-2 text-[#00FFE0] drop-shadow-[0_0_10px_rgba(0,255,224,0.5)]">Beta</span>
          </h1>
          <p className="text-zinc-500 mt-1">Exclusive trader community for sharing insights and strategies</p>
        </div>

        {/* Search Bar */}
        <div className="relative mb-8">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-500">
            <SearchIcon />
          </div>
          <input
            type="text"
            placeholder="Search traders, posts, or symbols..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-[#00FFE0]/50 focus:shadow-[0_0_15px_rgba(0,255,224,0.1)] transition-all"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Leaderboard */}
          <div className="lg:col-span-2 space-y-6">
            {/* Leaderboard Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  Top Traders
                  <span className="text-sm font-normal text-zinc-500">30 Day PnL</span>
                </h2>
                <button className="text-sm text-[#00FFE0] hover:underline">View All</button>
              </div>
              <div className="space-y-2">
                {DUMMY_TRADERS.map((trader) => (
                  <LeaderboardRow key={trader.id} trader={trader} />
                ))}
              </div>
            </div>

            {/* Timeline Section */}
            <div>
              <div className="flex items-center gap-4 mb-4 border-b border-[#1a1a1a]">
                <button
                  onClick={() => setActiveTab("trending")}
                  className={`pb-3 text-sm font-medium transition-colors relative ${
                    activeTab === "trending"
                      ? "text-[#00FFE0]"
                      : "text-zinc-500 hover:text-white"
                  }`}
                >
                  Trending
                  {activeTab === "trending" && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00FFE0] rounded-full" />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab("latest")}
                  className={`pb-3 text-sm font-medium transition-colors relative ${
                    activeTab === "latest"
                      ? "text-[#00FFE0]"
                      : "text-zinc-500 hover:text-white"
                  }`}
                >
                  Latest
                  {activeTab === "latest" && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00FFE0] rounded-full" />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab("following")}
                  className={`pb-3 text-sm font-medium transition-colors relative ${
                    activeTab === "following"
                      ? "text-[#00FFE0]"
                      : "text-zinc-500 hover:text-white"
                  }`}
                >
                  Following
                  {activeTab === "following" && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00FFE0] rounded-full" />
                  )}
                </button>
              </div>
              <div className="space-y-4">
                {DUMMY_POSTS.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            </div>
          </div>

          {/* Right Column - Featured Traders */}
          <div className="space-y-6">
            {/* Featured Traders */}
            <div>
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                Featured Traders
              </h2>
              <div className="space-y-3">
                {FEATURED_TRADERS.map((trader) => (
                  <FeaturedTraderCard key={trader.id} trader={trader} />
                ))}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="p-4 bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl">
              <h3 className="font-bold text-white mb-3">Community Stats</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Total Traders</span>
                  <span className="font-medium text-white">12,847</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Active Today</span>
                  <span className="font-medium text-green-500">3,421</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Total Volume (30d)</span>
                  <span className="font-medium text-white">$847M</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Posts Today</span>
                  <span className="font-medium text-white">1,256</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
