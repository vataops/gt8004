"use client";

import { useState, useEffect } from "react";
import { tradingApi, accountApi, PositionWithPnL, Position, Order, Balance } from "@/lib/api";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/components/Toast";

type TabType = "positions" | "openOrders" | "order_history" | "balances";

// Demo mode flag - set to true to show dummy data for screenshots
const DEMO_MODE = true;

// Demo mark price (matching chart's last price)
const DEMO_MARK_PRICE = 95093.42;

// Dummy positions for demo
// PnL calculated based on mark price vs entry price
const DUMMY_POSITIONS: PositionWithPnL[] = [
  {
    id: "demo-1",
    user_id: "demo",
    address: "addr_test1...",
    symbol: "BTC_USD",
    side: "Long",
    amount: 0.0521,
    entry_price: 94250.00,
    collateral: 500,
    leverage: 10,
    is_open: true,
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    tx_hash: "abc123",
    output_index: 0,
    // Long PnL: (mark - entry) * amount = (95093.42 - 94250) * 0.0521 = 43.93
    // ROE%: (pnl / collateral) * 100 = (43.93 / 500) * 100 = 8.79%
    unrealized_pnl: 43.93,
    pnl_percent: 8.79,
    // Liq price for Long: entry * (1 - 1/leverage + maintenance)
    // Simplified: entry - (collateral / amount) = 94250 - (500 / 0.0521) = 84654
    liquidation_price: 84654.12,
    mark_price: DEMO_MARK_PRICE,
  },
  {
    id: "demo-2",
    user_id: "demo",
    address: "addr_test1...",
    symbol: "BTC_USD",
    side: "Short",
    amount: 0.0312,
    entry_price: 95850.00,
    collateral: 300,
    leverage: 10,
    is_open: true,
    created_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    tx_hash: "def456",
    output_index: 0,
    // Short PnL: (entry - mark) * amount = (95850 - 95093.42) * 0.0312 = 23.60
    // ROE%: (pnl / collateral) * 100 = (23.60 / 300) * 100 = 7.87%
    unrealized_pnl: 23.60,
    pnl_percent: 7.87,
    // Liq price for Short: entry + (collateral / amount) = 95850 + (300 / 0.0312) = 105467
    liquidation_price: 105467.95,
    mark_price: DEMO_MARK_PRICE,
  },
];

// Dummy closed positions for demo
const DUMMY_POSITION_HISTORY: Position[] = [
  {
    id: "hist-1",
    user_id: "demo",
    address: "addr_test1...",
    symbol: "BTC_USD",
    side: "Long",
    amount: 0.0425,
    entry_price: 92150.00,
    collateral: 400,
    leverage: 10,
    is_open: false,
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    closed_at: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
    close_price: 95280.00,
    realized_pnl: 132.94,
  },
  {
    id: "hist-2",
    user_id: "demo",
    address: "addr_test1...",
    symbol: "BTC_USD",
    side: "Short",
    amount: 0.0280,
    entry_price: 96500.00,
    collateral: 250,
    leverage: 10,
    is_open: false,
    created_at: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(),
    closed_at: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(),
    close_price: 97850.00,
    realized_pnl: -37.80,
  },
  {
    id: "hist-3",
    user_id: "demo",
    address: "addr_test1...",
    symbol: "BTC_USD",
    side: "Long",
    amount: 0.0650,
    entry_price: 89200.00,
    collateral: 600,
    leverage: 10,
    is_open: false,
    created_at: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
    closed_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    close_price: 94100.00,
    realized_pnl: 318.50,
  },
];

// Dummy balances for demo
const DUMMY_BALANCES: Balance[] = [
  { asset: "USD", available: 2847.50, locked: 800, total: 3647.50 },
  { asset: "ADA", available: 15420.00, locked: 0, total: 15420.00 },
];

interface BottomPanelProps {
  walletAddress?: string | null;
}

export default function BottomPanel({ walletAddress: propWalletAddress }: BottomPanelProps = {}) {
  const wallet = useWallet();
  const { showToast } = useToast();
  const walletAddress = propWalletAddress ?? wallet?.walletAddress;

  const [activeTab, setActiveTab] = useState<TabType>("positions");
  const [positions, setPositions] = useState<PositionWithPnL[]>(DEMO_MODE ? DUMMY_POSITIONS : []);
  const [openOrders, setOpenOrders] = useState<Order[]>([]);
  const [balances, setBalances] = useState<Balance[]>(DEMO_MODE ? DUMMY_BALANCES : []);
  const [loading, setLoading] = useState(DEMO_MODE ? false : true);
  const [initialLoad, setInitialLoad] = useState(DEMO_MODE ? false : true);
  const [closingPositionId, setClosingPositionId] = useState<string | null>(null);

  // Load positions with PnL from backend
  useEffect(() => {
    // Skip API calls in demo mode
    if (DEMO_MODE) return;

    if (!walletAddress) {
      setPositions([]);
      setLoading(false);
      setInitialLoad(false);
      return;
    }

    const loadPositions = async () => {
      // Only show loading on initial load, not on refresh
      if (initialLoad) setLoading(true);

      try {
        const data = await tradingApi.getPositionsWithPnL(walletAddress);
        setPositions(data);
      } catch (err) {
        console.error("Failed to load positions:", err);
        // Don't clear positions on error during refresh
        if (initialLoad) setPositions([]);
      } finally {
        setLoading(false);
        setInitialLoad(false);
      }
    };

    loadPositions();
    const interval = setInterval(loadPositions, 3000); // Refresh every 3 seconds
    return () => clearInterval(interval);
  }, [walletAddress, initialLoad]);

  // Load balances from on-chain
  useEffect(() => {
    // Skip API calls in demo mode
    if (DEMO_MODE) return;

    if (!walletAddress) {
      setBalances([]);
      return;
    }

    const loadBalances = async () => {
      try {
        const data = await accountApi.getBalances(walletAddress);
        setBalances(data);
      } catch (err) {
        console.error("Failed to load balances:", err);
        setBalances([]);
      }
    };

    loadBalances();
    const interval = setInterval(loadBalances, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [walletAddress]);

  // Load position history (closed positions)
  const [positionHistory, setPositionHistory] = useState<Position[]>(DEMO_MODE ? DUMMY_POSITION_HISTORY : []);

  useEffect(() => {
    // Skip API calls in demo mode
    if (DEMO_MODE) return;

    if (!walletAddress) {
      setPositionHistory([]);
      return;
    }

    const loadPositionHistory = async () => {
      try {
        const data = await tradingApi.getPositionHistory(walletAddress);
        setPositionHistory(data);
      } catch (err) {
        console.error("Failed to load position history:", err);
        setPositionHistory([]);
      }
    };

    loadPositionHistory();
    // Refresh when positions change (after closing)
  }, [walletAddress, positions.length]);

  const handleClosePosition = async (positionId: string) => {
    if (!walletAddress) return;

    // Find position to get symbol for oracle lookup
    const position = positions.find(p => p.id === positionId);
    if (!position) {
      showToast({
        type: "error",
        title: "Position Not Found",
        message: "Could not find position to close",
      });
      return;
    }

    // Extract base symbol (e.g., "BTC" from "BTC_USD")
    const baseSymbol = position.symbol.split("_")[0];

    // Check if position has on-chain reference
    if (!position.tx_hash) {
      showToast({
        type: "error",
        title: "Cannot Close Position",
        message: "Position missing on-chain reference (tx_hash). This is a legacy position.",
      });
      return;
    }

    setClosingPositionId(positionId);
    try {
      // Use WalletContext closePosition which fetches oracle-signed price
      // Pass txHash#outputIndex to find exact UTxO on-chain
      const result = await wallet.closePosition({
        positionId,
        symbol: baseSymbol,
        side: position.side as 'Long' | 'Short',
        txHash: position.tx_hash,
        outputIndex: position.output_index ?? 0,
      });

      // Show result
      const isPnlPositive = result.realizedPnl >= 0;
      showToast({
        type: isPnlPositive ? "success" : "warning",
        title: "Position Closed",
        message: isPnlPositive ? "Trade closed with profit" : "Trade closed with loss",
        details: [
          { label: "Realized PnL", value: `${isPnlPositive ? "+" : ""}$${result.realizedPnl.toFixed(2)} (${result.pnlPercent.toFixed(2)}%)` },
          { label: "Close Price", value: `$${result.closePrice.toLocaleString()}` },
        ],
      });

      // Remove from local state
      setPositions(prev => prev.filter(p => p.id !== positionId));
    } catch (err) {
      console.error("Failed to close position:", err);
      showToast({
        type: "error",
        title: "Failed to Close Position",
        message: "Please try again later",
      });
    } finally {
      setClosingPositionId(null);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    try {
      await tradingApi.cancelOrder(orderId);
      setOpenOrders(prev => prev.filter(o => o.id !== orderId));
    } catch (err) {
      console.error("Failed to cancel order:", err);
    }
  };

  const tabs: { key: TabType; label: string; count?: number }[] = [
    { key: "positions", label: "Positions", count: positions.length },
    { key: "openOrders", label: "Open Orders", count: openOrders.length },
    { key: "order_history", label: "Trade History", count: positionHistory.length },
    { key: "balances", label: "Balances" },
  ];

  return (
    <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-lg overflow-hidden">
      {/* Tab Header */}
      <div className="flex border-b border-[#1f1f1f]">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-3 text-sm font-medium transition-all ${
              activeTab === tab.key
                ? "text-[#00FFE0] border-b-2 border-[#00FFE0]"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded ${
                activeTab === tab.key
                  ? "bg-[#00FFE0]/20 text-[#00FFE0]"
                  : "bg-zinc-700 text-zinc-300"
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="h-[200px] overflow-y-auto scrollbar-hide">
        {loading ? (
          <div className="flex items-center justify-center h-full text-zinc-500">
            <span className="animate-pulse">Loading...</span>
          </div>
        ) : (
          <>
            {activeTab === "positions" && (
              <PositionsTable positions={positions} onClose={handleClosePosition} closingId={closingPositionId} />
            )}
            {activeTab === "openOrders" && (
              <OpenOrdersTable orders={openOrders} onCancel={handleCancelOrder} />
            )}
            {activeTab === "order_history" && (
              <PositionHistoryTable positions={positionHistory} />
            )}
            {activeTab === "balances" && (
              <BalancesTable balances={balances} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function EmptyState({ message, icon }: { message: string; icon: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-zinc-500">
      <div className="opacity-30 mb-2">{icon}</div>
      <p className="text-sm">{message}</p>
    </div>
  );
}

function PositionsTable({
  positions,
  onClose,
  closingId
}: {
  positions: PositionWithPnL[];
  onClose: (id: string) => void;
  closingId?: string | null;
}) {
  if (positions.length === 0) {
    return (
      <EmptyState
        message="No open positions"
        icon={
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        }
      />
    );
  }

  return (
    <table className="w-full text-sm">
      <thead className="text-zinc-400 text-xs sticky top-0 bg-[#0f0f0f]">
        <tr className="border-b border-[#1f1f1f]">
          <th className="text-left px-4 py-2 font-medium">Symbol</th>
          <th className="text-left px-4 py-2 font-medium">Side</th>
          <th className="text-right px-4 py-2 font-medium">Size (BTC)</th>
          <th className="text-right px-4 py-2 font-medium">Notional (USD)</th>
          <th className="text-right px-4 py-2 font-medium">Collateral</th>
          <th className="text-right px-4 py-2 font-medium">Entry Price</th>
          <th className="text-right px-4 py-2 font-medium">Mark Price</th>
          <th className="text-right px-4 py-2 font-medium">PnL (ROE%)</th>
          <th className="text-right px-4 py-2 font-medium">Leverage</th>
          <th className="text-right px-4 py-2 font-medium">Liq. Price</th>
          <th className="text-center px-4 py-2 font-medium">Actions</th>
        </tr>
      </thead>
      <tbody>
        {positions.map((pos) => {
          const isPnlPositive = pos.unrealized_pnl >= 0;
          const isClosing = closingId === pos.id;
          // Notional value = size * entry price (position value in USD)
          const notionalValue = pos.amount * pos.entry_price;
          return (
            <tr key={pos.id} className="border-b border-[#1f1f1f]/50 hover:bg-[#00FFE0]/5 transition-colors">
              <td className="px-4 py-3 text-white">{pos.symbol.replace(/_USD$/, "")}</td>
              <td className={`px-4 py-3 ${pos.side === "Long" ? "text-[#00FFE0]" : "text-red-500"}`}>
                {pos.side}
              </td>
              <td className="px-4 py-3 text-right text-white">{pos.amount.toFixed(4)}</td>
              <td className="px-4 py-3 text-right text-zinc-300">${notionalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td className="px-4 py-3 text-right text-zinc-300">${pos.collateral.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td className="px-4 py-3 text-right text-zinc-300">${pos.entry_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td className="px-4 py-3 text-right text-zinc-300">${pos.mark_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              <td className={`px-4 py-3 text-right font-medium ${isPnlPositive ? "text-[#00FFE0]" : "text-red-500"}`}>
                ${isPnlPositive ? "+" : ""}{pos.unrealized_pnl.toFixed(2)} ({pos.pnl_percent.toFixed(2)}%)
              </td>
              <td className="px-4 py-3 text-right text-[#00FFE0]/70">{pos.leverage}x</td>
              <td className="px-4 py-3 text-right text-zinc-400">${pos.liquidation_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td className="px-4 py-3 text-center">
                <button className="px-2 py-1 text-xs bg-[#1a1a1a] hover:bg-[#00FFE0]/10 hover:text-[#00FFE0] border border-[#1f1f1f] hover:border-[#00FFE0]/30 rounded mr-1 transition-all">
                  TP/SL
                </button>
                <button
                  onClick={() => onClose(pos.id)}
                  disabled={isClosing}
                  className={`px-2 py-1 text-xs border rounded transition-all ${
                    isClosing
                      ? "bg-zinc-700 text-zinc-400 border-zinc-600 cursor-not-allowed"
                      : "bg-red-500/10 text-red-400 hover:bg-red-500/20 border-red-500/30"
                  }`}
                >
                  {isClosing ? "Closing..." : "Close"}
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function OpenOrdersTable({ orders, onCancel }: { orders: Order[]; onCancel: (id: string) => void }) {
  if (orders.length === 0) {
    return (
      <EmptyState
        message="No open orders"
        icon={
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        }
      />
    );
  }

  return (
    <table className="w-full text-sm">
      <thead className="text-zinc-400 text-xs sticky top-0 bg-[#0f0f0f]">
        <tr className="border-b border-[#1f1f1f]">
          <th className="text-left px-4 py-2 font-medium">Time</th>
          <th className="text-left px-4 py-2 font-medium">Symbol</th>
          <th className="text-left px-4 py-2 font-medium">Type</th>
          <th className="text-left px-4 py-2 font-medium">Side</th>
          <th className="text-right px-4 py-2 font-medium">Price</th>
          <th className="text-right px-4 py-2 font-medium">Amount</th>
          <th className="text-right px-4 py-2 font-medium">Filled</th>
          <th className="text-center px-4 py-2 font-medium">Actions</th>
        </tr>
      </thead>
      <tbody>
        {orders.map((order) => (
          <tr key={order.id} className="border-b border-[#1f1f1f]/50 hover:bg-[#00FFE0]/5 transition-colors">
            <td className="px-4 py-3 text-zinc-400">{order.created_at}</td>
            <td className="px-4 py-3 text-white">{order.symbol.replace(/_/g, "/")}</td>
            <td className="px-4 py-3 text-zinc-300">{order.type}</td>
            <td className={`px-4 py-3 ${order.side === "Buy" ? "text-[#00FFE0]" : "text-red-500"}`}>
              {order.side}
            </td>
            <td className="px-4 py-3 text-right text-zinc-300">${order.price}</td>
            <td className="px-4 py-3 text-right text-white">{order.amount}</td>
            <td className="px-4 py-3 text-right text-zinc-400">{order.filled}</td>
            <td className="px-4 py-3 text-center">
              <button className="px-2 py-1 text-xs bg-[#1a1a1a] hover:bg-[#00FFE0]/10 hover:text-[#00FFE0] border border-[#1f1f1f] hover:border-[#00FFE0]/30 rounded mr-1 transition-all">
                Edit
              </button>
              <button 
                onClick={() => onCancel(order.id)}
                className="px-2 py-1 text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 rounded transition-all"
              >
                Cancel
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PositionHistoryTable({ positions }: { positions: Position[] }) {
  if (positions.length === 0) {
    return (
      <EmptyState
        message="No closed positions"
        icon={
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
      />
    );
  }

  // Helper to format symbol (remove _USD suffix for display)
  const formatSymbol = (symbol: string) => {
    return symbol.replace(/_USD$/, "").replace(/_/g, "/");
  };

  return (
    <table className="w-full text-sm">
      <thead className="text-zinc-400 text-xs sticky top-0 bg-[#0f0f0f]">
        <tr className="border-b border-[#1f1f1f]">
          <th className="text-left px-4 py-2 font-medium">Closed At</th>
          <th className="text-left px-4 py-2 font-medium">Symbol</th>
          <th className="text-left px-4 py-2 font-medium">Side</th>
          <th className="text-right px-4 py-2 font-medium">Size (BTC)</th>
          <th className="text-right px-4 py-2 font-medium">Notional (USD)</th>
          <th className="text-right px-4 py-2 font-medium">Entry Price</th>
          <th className="text-right px-4 py-2 font-medium">Close Price</th>
          <th className="text-right px-4 py-2 font-medium">Realized PnL</th>
        </tr>
      </thead>
      <tbody>
        {positions.map((pos) => {
          const pnl = pos.realized_pnl || 0;
          const isPnlPositive = pnl >= 0;
          const pnlPercent = pos.collateral > 0 ? (pnl / pos.collateral) * 100 : 0;
          const notionalValue = pos.amount * pos.entry_price;
          return (
            <tr key={pos.id} className="border-b border-[#1f1f1f]/50 hover:bg-[#00FFE0]/5 transition-colors">
              <td className="px-4 py-3 text-zinc-400">
                {pos.closed_at ? new Date(pos.closed_at).toLocaleString() : '-'}
              </td>
              <td className="px-4 py-3 text-white">{formatSymbol(pos.symbol)}</td>
              <td className={`px-4 py-3 ${pos.side === "Long" ? "text-[#00FFE0]" : "text-red-500"}`}>
                {pos.side}
              </td>
              <td className="px-4 py-3 text-right text-white">{pos.amount.toFixed(4)}</td>
              <td className="px-4 py-3 text-right text-zinc-300">
                ${notionalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td className="px-4 py-3 text-right text-zinc-300">
                ${pos.entry_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td className="px-4 py-3 text-right text-zinc-300">
                ${pos.close_price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '-'}
              </td>
              <td className={`px-4 py-3 text-right font-medium ${isPnlPositive ? "text-[#00FFE0]" : "text-red-500"}`}>
                {isPnlPositive ? "+" : ""}${pnl.toFixed(2)} ({pnlPercent.toFixed(2)}%)
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function BalancesTable({ balances }: { balances: Balance[] }) {
  if (balances.length === 0) {
    return (
      <EmptyState
        message="No assets"
        icon={
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
        }
      />
    );
  }

  return (
    <table className="w-full text-sm">
      <thead className="text-zinc-400 text-xs sticky top-0 bg-[#0f0f0f]">
        <tr className="border-b border-[#1f1f1f]">
          <th className="text-left px-4 py-2 font-medium">Asset</th>
          <th className="text-right px-4 py-2 font-medium">Available</th>
          <th className="text-right px-4 py-2 font-medium">In Order</th>
          <th className="text-right px-4 py-2 font-medium">Total</th>
          <th className="text-center px-4 py-2 font-medium">Actions</th>
        </tr>
      </thead>
      <tbody>
        {balances.map((balance) => (
          <tr key={balance.asset} className="border-b border-[#1f1f1f]/50 hover:bg-[#00FFE0]/5 transition-colors">
            <td className="px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-[#00FFE0]/10 border border-[#00FFE0]/30 rounded-full flex items-center justify-center text-xs font-bold text-[#00FFE0]">
                  {balance.asset.charAt(0)}
                </div>
                <span className="text-white font-medium">{balance.asset}</span>
              </div>
            </td>
            <td className="px-4 py-3 text-right text-white">{balance.available.toFixed(2)}</td>
            <td className="px-4 py-3 text-right text-zinc-400">{balance.locked.toFixed(2)}</td>
            <td className="px-4 py-3 text-right text-zinc-300">{balance.total.toFixed(2)}</td>
            <td className="px-4 py-3 text-center">
              <button className="px-2 py-1 text-xs bg-[#00FFE0]/10 text-[#00FFE0] hover:bg-[#00FFE0]/20 border border-[#00FFE0]/30 rounded mr-1 transition-all">
                Deposit
              </button>
              <button className="px-2 py-1 text-xs bg-[#1a1a1a] hover:bg-[#1f1f1f] border border-[#1f1f1f] rounded transition-all">
                Withdraw
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
