"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Chart from "@/components/Chart";

// ============ DUMMY DATA ============

// ADAMaximalist trader profile (featured trader)
const TRADER_PROFILE = {
  id: "adamaxi",
  username: "ADAMaximalist",
  bio: "Cardano believer since 2017. Building the future of DeFi on the most decentralized blockchain.",
  walletAddress: "addr1qx8f3...k29m",
  joinedDate: "Jan 2024",
  isVerified: true,
  hasNFT: true,
  hasPremium: true,

  // Stats
  followers: 15200,
  following: 342,
  totalPnl: 284520.45,
  pnlPercent: 142.3,
  winRate: 78.5,
  totalTrades: 892,
  avgLeverage: 5.2,
  bestTrade: 42350.80,
  worstTrade: -8420.30,

  // Social links
  twitter: "ADAMaximalist",

  // Subscription tiers
  subscriptionPrice: 50, // USDM per month
  premiumSubscribers: 234,
};

// Trader's posts/timeline
const TRADER_POSTS = [
  {
    id: "tp1",
    content: "BTC holding strong at $94K support. Loading up for the next leg up. Institutional adoption is accelerating!",
    position: {
      symbol: "BTC_USD",
      side: "Long",
      entry: 94000,
      exit: null,
      pnl: 2340.50,
      leverage: 5,
    },
    chartImage: "/charts/btc-analysis.png",
    likes: 189,
    comments: 34,
    shares: 42,
    timestamp: "4h ago",
    isFromTwitter: true,
    isPremium: false,
  },
  {
    id: "tp2",
    content: "Just hit my target on BTC! Took profits at $95.2K. Now watching for a pullback to re-enter around $92K.",
    position: {
      symbol: "BTC_USD",
      side: "Long",
      entry: 91250,
      exit: 95200,
      pnl: 12450.80,
      leverage: 10,
    },
    chartImage: null,
    likes: 342,
    comments: 56,
    shares: 89,
    timestamp: "1d ago",
    isFromTwitter: false,
    isPremium: false,
  },
  {
    id: "tp3",
    content: "Premium Analysis: My complete breakdown of the upcoming Cardano governance vote and how it will affect ADA price. Includes entry points, targets, and risk management.",
    position: null,
    chartImage: null,
    likes: 567,
    comments: 123,
    shares: 34,
    timestamp: "2d ago",
    isFromTwitter: false,
    isPremium: true,
  },
  {
    id: "tp4",
    content: "Weekly update: +$18,450 this week. 7 wins, 2 losses. Key insight: patience at support levels pays off. Full trade journal in premium.",
    position: null,
    chartImage: "/charts/weekly-pnl.png",
    likes: 892,
    comments: 145,
    shares: 67,
    timestamp: "3d ago",
    isFromTwitter: true,
    isPremium: false,
  },
];

// Trading history for chart markers
const TRADE_HISTORY = [
  { id: "t1", symbol: "ADA_USD", side: "Long", entry: 0.42, exit: 0.48, pnl: 3240.50, date: "Jan 12", leverage: 5 },
  { id: "t2", symbol: "BTC_USD", side: "Long", entry: 91250, exit: 95200, pnl: 12450.80, date: "Jan 10", leverage: 10 },
  { id: "t3", symbol: "ETH_USD", side: "Short", entry: 3520, exit: 3380, pnl: 4200.00, date: "Jan 8", leverage: 3 },
  { id: "t4", symbol: "ADA_USD", side: "Long", entry: 0.38, exit: 0.45, pnl: 5600.20, date: "Jan 5", leverage: 8 },
  { id: "t5", symbol: "SOL_USD", side: "Short", entry: 185, exit: 172, pnl: 2340.00, date: "Jan 3", leverage: 4 },
];

// Comments on posts
const SAMPLE_COMMENTS = [
  { id: "c1", username: "CryptoTrader99", content: "Great analysis! Following this trade.", timestamp: "2h ago" },
  { id: "c2", username: "DeFiDegen", content: "What's your stop loss on this one?", timestamp: "3h ago" },
  { id: "c3", username: "HODLer2024", content: "ADA to the moon!", timestamp: "4h ago" },
];

// ============ ICONS ============

const BackIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
  </svg>
);

const VerifiedIcon = () => (
  <svg className="w-5 h-5 text-[#00FFE0]" fill="currentColor" viewBox="0 0 24 24">
    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const NFTBadgeIcon = () => (
  <svg className="w-5 h-5 text-purple-400" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
  </svg>
);

const TwitterIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
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

const LockIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);

const DonateIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ChartIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
  </svg>
);

// ============ COMPONENTS ============

// Trader Avatar Component (large)
const TraderAvatarLarge = ({ username }: { username: string }) => {
  const colors = [
    "from-[#00FFE0] to-cyan-600",
    "from-purple-500 to-pink-500",
    "from-orange-500 to-red-500",
    "from-green-500 to-emerald-600",
    "from-blue-500 to-indigo-600",
  ];
  const colorIndex = username.charCodeAt(0) % colors.length;

  return (
    <div className={`w-24 h-24 rounded-full bg-gradient-to-br ${colors[colorIndex]} flex items-center justify-center text-3xl font-bold text-white border-4 border-[#0a0a0a]`}>
      {username.charAt(0).toUpperCase()}
    </div>
  );
};

// Small avatar for comments
const SmallAvatar = ({ username }: { username: string }) => {
  const colors = [
    "from-[#00FFE0] to-cyan-600",
    "from-purple-500 to-pink-500",
    "from-orange-500 to-red-500",
  ];
  const colorIndex = username.charCodeAt(0) % colors.length;

  return (
    <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${colors[colorIndex]} flex items-center justify-center text-xs font-bold text-white`}>
      {username.charAt(0).toUpperCase()}
    </div>
  );
};

// Trading Chart Section with real chart component
const TradingChartSection = () => (
  <div className="space-y-4">
    {/* Chart */}
    <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl overflow-hidden">
      <div className="h-[400px]">
        <Chart symbol="BTC_USD" />
      </div>
    </div>

    {/* Recent trades list */}
    <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl p-4">
      <h3 className="font-bold text-white mb-4 flex items-center gap-2">
        <ChartIcon />
        Recent Trades
      </h3>
      <div className="space-y-2">
        {TRADE_HISTORY.slice(0, 3).map((trade) => (
          <div key={trade.id} className="flex items-center justify-between p-2 bg-[#1a1a1a] rounded-lg text-sm">
            <div className="flex items-center gap-3">
              <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                trade.side === "Long" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
              }`}>
                {trade.side}
              </span>
              <span className="text-white">{trade.symbol.replace("_", "/")}</span>
              <span className="text-zinc-500">{trade.leverage}x</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-zinc-500">{trade.date}</span>
              <span className={trade.pnl >= 0 ? "text-green-500" : "text-red-500"}>
                {trade.pnl >= 0 ? "+" : ""}${trade.pnl.toLocaleString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// Post Card with comments
const TraderPostCard = ({ post, showComments }: { post: typeof TRADER_POSTS[0]; showComments?: boolean }) => {
  const [isCommentsOpen, setIsCommentsOpen] = useState(showComments || false);
  const [newComment, setNewComment] = useState("");

  return (
    <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          {post.isFromTwitter && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-zinc-800 rounded text-xs text-zinc-400">
              <TwitterIcon />
              <span>via X</span>
            </span>
          )}
          {post.isPremium && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-purple-900/50 border border-purple-500/30 rounded text-xs text-purple-400">
              <LockIcon />
              <span>Premium</span>
            </span>
          )}
          <span className="text-xs text-zinc-500">{post.timestamp}</span>
        </div>

        {/* Content */}
        <p className="text-sm text-zinc-300">{post.content}</p>

        {/* Premium Lock */}
        {post.isPremium && (
          <div className="mt-3 p-4 bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-purple-500/30 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <LockIcon />
              <span className="font-medium text-white">Premium Content</span>
            </div>
            <p className="text-sm text-zinc-400 mb-3">Subscribe to access this exclusive analysis</p>
            <button className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg hover:from-purple-500 hover:to-pink-500 transition-all">
              Subscribe for ${TRADER_PROFILE.subscriptionPrice}/month
            </button>
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

        {/* Chart with position markers */}
        {post.chartImage && !post.isPremium && (
          <div className="mt-3 rounded-lg overflow-hidden border border-zinc-800">
            <div className="h-[250px]">
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
          <button
            onClick={() => setIsCommentsOpen(!isCommentsOpen)}
            className={`flex items-center gap-1.5 transition-colors ${isCommentsOpen ? "text-[#00FFE0]" : "text-zinc-500 hover:text-[#00FFE0]"}`}
          >
            <CommentIcon />
            <span className="text-sm">{post.comments}</span>
          </button>
          <button className="flex items-center gap-1.5 text-zinc-500 hover:text-blue-400 transition-colors">
            <ShareIcon />
            <span className="text-sm">{post.shares}</span>
          </button>
        </div>
      </div>

      {/* Comments Section */}
      {isCommentsOpen && (
        <div className="border-t border-[#1a1a1a] p-4">
          {/* Comment input */}
          <div className="flex items-start gap-3 mb-4">
            <SmallAvatar username="You" />
            <div className="flex-1">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment..."
                className="w-full px-3 py-2 bg-[#1a1a1a] border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#00FFE0]/50"
              />
            </div>
            <button className="px-4 py-2 text-sm font-medium text-[#00FFE0] bg-[#00FFE0]/10 border border-[#00FFE0]/30 rounded-lg hover:bg-[#00FFE0]/20 transition-all">
              Post
            </button>
          </div>

          {/* Comments list */}
          <div className="space-y-3">
            {SAMPLE_COMMENTS.map((comment) => (
              <div key={comment.id} className="flex items-start gap-3">
                <SmallAvatar username={comment.username} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{comment.username}</span>
                    <span className="text-xs text-zinc-500">{comment.timestamp}</span>
                  </div>
                  <p className="text-sm text-zinc-400 mt-0.5">{comment.content}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ============ MAIN PAGE ============

export default function TraderProfilePage() {
  const params = useParams();
  const [activeTab, setActiveTab] = useState<"posts" | "trades" | "about">("posts");

  // For demo, always show ADAMaximalist profile
  const trader = TRADER_PROFILE;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Back button */}
        <Link href="/lounge" className="inline-flex items-center gap-2 text-zinc-400 hover:text-[#00FFE0] transition-colors mb-6">
          <BackIcon />
          <span>Back to Lounge</span>
        </Link>

        {/* Profile Header */}
        <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl p-6 mb-6">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            {/* Avatar */}
            <TraderAvatarLarge username={trader.username} />

            {/* Info */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-white">{trader.username}</h1>
                {trader.isVerified && <VerifiedIcon />}
                {trader.hasNFT && <NFTBadgeIcon />}
              </div>
              <p className="text-zinc-400 text-sm mb-3">{trader.bio}</p>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-zinc-500">{trader.walletAddress}</span>
                <span className="text-zinc-500">Joined {trader.joinedDate}</span>
                {trader.twitter && (
                  <a href={`https://x.com/${trader.twitter}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-zinc-400 hover:text-white transition-colors">
                    <TwitterIcon />
                    <span>@{trader.twitter}</span>
                  </a>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-2 w-full md:w-auto">
              <button className="px-6 py-2 text-sm font-medium text-[#00FFE0] bg-[#00FFE0]/10 border border-[#00FFE0]/30 rounded-lg hover:bg-[#00FFE0]/20 transition-all">
                Subscribe ${trader.subscriptionPrice}/mo
              </button>
              <button className="px-6 py-2 text-sm font-medium text-white bg-[#1a1a1a] border border-zinc-700 rounded-lg hover:bg-zinc-800 transition-all flex items-center justify-center gap-2">
                <DonateIcon />
                Donate
              </button>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6 pt-6 border-t border-[#1a1a1a]">
            <div className="text-center">
              <div className="text-xl font-bold text-white">{trader.followers.toLocaleString()}</div>
              <div className="text-xs text-zinc-500">Followers</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-green-500">+${trader.totalPnl.toLocaleString()}</div>
              <div className="text-xs text-zinc-500">Total PnL</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-white">{trader.winRate}%</div>
              <div className="text-xs text-zinc-500">Win Rate</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-white">{trader.totalTrades}</div>
              <div className="text-xs text-zinc-500">Total Trades</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-purple-400">{trader.premiumSubscribers}</div>
              <div className="text-xs text-zinc-500">Subscribers</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-4 mb-6 border-b border-[#1a1a1a]">
          <button
            onClick={() => setActiveTab("posts")}
            className={`pb-3 text-sm font-medium transition-colors relative ${
              activeTab === "posts" ? "text-[#00FFE0]" : "text-zinc-500 hover:text-white"
            }`}
          >
            Posts
            {activeTab === "posts" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00FFE0] rounded-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("trades")}
            className={`pb-3 text-sm font-medium transition-colors relative ${
              activeTab === "trades" ? "text-[#00FFE0]" : "text-zinc-500 hover:text-white"
            }`}
          >
            Trades
            {activeTab === "trades" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00FFE0] rounded-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("about")}
            className={`pb-3 text-sm font-medium transition-colors relative ${
              activeTab === "about" ? "text-[#00FFE0]" : "text-zinc-500 hover:text-white"
            }`}
          >
            About
            {activeTab === "about" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00FFE0] rounded-full" />
            )}
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "posts" && (
          <div className="space-y-4">
            {TRADER_POSTS.map((post) => (
              <TraderPostCard key={post.id} post={post} />
            ))}
          </div>
        )}

        {activeTab === "trades" && (
          <div className="space-y-6">
            <TradingChartSection />

            {/* All trades */}
            <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl p-4">
              <h3 className="font-bold text-white mb-4">All Trades</h3>
              <div className="space-y-2">
                {TRADE_HISTORY.map((trade) => (
                  <div key={trade.id} className="flex items-center justify-between p-3 bg-[#1a1a1a] rounded-lg">
                    <div className="flex items-center gap-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        trade.side === "Long" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                      }`}>
                        {trade.side}
                      </span>
                      <span className="font-medium text-white">{trade.symbol.replace("_", "/")}</span>
                      <span className="text-zinc-500">{trade.leverage}x</span>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="text-xs text-zinc-500">Entry</div>
                        <div className="text-sm text-white">${trade.entry.toLocaleString()}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-zinc-500">Exit</div>
                        <div className="text-sm text-white">${trade.exit.toLocaleString()}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-zinc-500">PnL</div>
                        <div className={`text-sm font-bold ${trade.pnl >= 0 ? "text-green-500" : "text-red-500"}`}>
                          {trade.pnl >= 0 ? "+" : ""}${trade.pnl.toLocaleString()}
                        </div>
                      </div>
                      <span className="text-xs text-zinc-500 w-16 text-right">{trade.date}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "about" && (
          <div className="space-y-6">
            {/* Bio */}
            <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl p-6">
              <h3 className="font-bold text-white mb-3">About</h3>
              <p className="text-zinc-400">{trader.bio}</p>
            </div>

            {/* Stats */}
            <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl p-6">
              <h3 className="font-bold text-white mb-4">Trading Statistics</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-[#1a1a1a] rounded-lg">
                  <div className="text-xs text-zinc-500">Total PnL</div>
                  <div className="text-lg font-bold text-green-500">+${trader.totalPnl.toLocaleString()}</div>
                </div>
                <div className="p-3 bg-[#1a1a1a] rounded-lg">
                  <div className="text-xs text-zinc-500">Win Rate</div>
                  <div className="text-lg font-bold text-white">{trader.winRate}%</div>
                </div>
                <div className="p-3 bg-[#1a1a1a] rounded-lg">
                  <div className="text-xs text-zinc-500">Best Trade</div>
                  <div className="text-lg font-bold text-green-500">+${trader.bestTrade.toLocaleString()}</div>
                </div>
                <div className="p-3 bg-[#1a1a1a] rounded-lg">
                  <div className="text-xs text-zinc-500">Worst Trade</div>
                  <div className="text-lg font-bold text-red-500">${trader.worstTrade.toLocaleString()}</div>
                </div>
                <div className="p-3 bg-[#1a1a1a] rounded-lg">
                  <div className="text-xs text-zinc-500">Avg Leverage</div>
                  <div className="text-lg font-bold text-white">{trader.avgLeverage}x</div>
                </div>
                <div className="p-3 bg-[#1a1a1a] rounded-lg">
                  <div className="text-xs text-zinc-500">Total Trades</div>
                  <div className="text-lg font-bold text-white">{trader.totalTrades}</div>
                </div>
              </div>
            </div>

            {/* Premium info */}
            {trader.hasPremium && (
              <div className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-purple-500/30 rounded-xl p-6">
                <h3 className="font-bold text-white mb-2">Premium Subscription</h3>
                <p className="text-zinc-400 text-sm mb-4">
                  Get access to exclusive trade signals, in-depth analysis, and direct Q&A with {trader.username}.
                </p>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-2xl font-bold text-white">${trader.subscriptionPrice}</span>
                    <span className="text-zinc-400">/month</span>
                  </div>
                  <button className="px-6 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg hover:from-purple-500 hover:to-pink-500 transition-all">
                    Subscribe Now
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
