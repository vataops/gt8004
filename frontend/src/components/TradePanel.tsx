"use client";

import React, { useState, useEffect } from "react";
import { marketApi, accountApi, Ticker } from "@/lib/api";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/components/Toast";

// Demo mode flag - set to true to show dummy data for screenshots
const DEMO_MODE = true;
const DEMO_BALANCE = 2847.50;

interface TradePanelProps {
  symbol?: string;
  walletAddress?: string | null;
}

const TradePanel = ({ symbol = "BTC_USD", walletAddress }: TradePanelProps) => {
  const { openPosition } = useWallet();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState("buy"); // 'buy' or 'sell'
  const [marginType, setMarginType] = useState("Cross"); // 'Cross' or 'Isolated'
  const [leverage, setLeverage] = useState("10"); // Numeric leverage
  const [orderType, setOrderType] = useState("market"); // market, limit
  const [price, setPrice] = useState("");
  const [amount, setAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticker, setTicker] = useState<Ticker | null>(null);
  const [balance, setBalance] = useState<number>(DEMO_MODE ? DEMO_BALANCE : 0);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

  const leverageOptions = ["1", "5", "10", "20", "50", "100"];

  // Load balance when wallet is connected
  useEffect(() => {
    // Skip API calls in demo mode
    if (DEMO_MODE) return;

    if (!walletAddress) {
      setBalance(0);
      return;
    }

    const loadBalance = async () => {
      setIsLoadingBalance(true);
      try {
        const usdmBalance = await accountApi.getUSDBalance(walletAddress);
        setBalance(usdmBalance);
      } catch (err) {
        console.error("Failed to load balance:", err);
        setBalance(0);
      } finally {
        setIsLoadingBalance(false);
      }
    };

    loadBalance();
    // Refresh balance every 30 seconds
    const interval = setInterval(loadBalance, 30000);
    return () => clearInterval(interval);
  }, [walletAddress]);

  // Load current price for reference
  useEffect(() => {
    const loadTicker = async () => {
      try {
        const data = await marketApi.getTicker(symbol);
        setTicker(data);
      } catch (err) {
        console.error("Failed to load ticker:", err);
      }
    };
    loadTicker();
    const interval = setInterval(loadTicker, 5000);
    return () => clearInterval(interval);
  }, [symbol]);

  const handleSubmit = async () => {
    if (!walletAddress) {
      setError("Please connect your wallet first");
      return;
    }

    if (!amount || (orderType === "limit" && !price)) {
      setError("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const entryPrice = orderType === "limit" ? parseFloat(price) : (ticker?.last_price || 0);
      const collateralAmount = parseFloat(amount); // USD margin
      const leverageValue = parseInt(leverage);

      // 레버리지가 적용된 총 USD 가치 (예: 10 USD * 50x = 500 USD)
      const totalPositionValue = collateralAmount * leverageValue;

      // 총 USD 가치를 BTC 수량으로 변환
      const btcAmount = totalPositionValue / entryPrice;

      // Build, sign, and submit TX using Lucid (via WalletContext)
      const txHash = await openPosition({
        symbol,
        side: activeTab === "buy" ? "Long" : "Short",
        entryPrice,
        amount: btcAmount,
        collateral: collateralAmount,
        leverage: leverageValue,
      });

      // Clear form
      setAmount("");
      if (orderType === "limit") setPrice("");

      showToast({
        type: "success",
        title: "Position Opened Successfully",
        message: `${activeTab === "buy" ? "Long" : "Short"} position created on-chain`,
        details: [
          { label: "TX Hash", value: txHash },
          { label: "Collateral", value: `${collateralAmount.toLocaleString()} USD` },
          { label: "Total Value", value: `$${totalPositionValue.toLocaleString()}` },
          { label: "Size", value: `${btcAmount.toFixed(4)} BTC` },
        ],
      });
    } catch (err: unknown) {
      console.error("Failed to place order:", err);
      const error = err as { message?: string; info?: string };
      if (error.message?.includes("User declined")) {
        setError("Transaction was rejected by the wallet.");
      } else if (error.message?.includes("position contract address not configured")) {
        setError("Position contract not deployed yet. Please try again later.");
      } else {
        setError(error.message || "Failed to place order. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const quoteAsset = symbol.split("_")[1] || "USD";

  // Calculate estimated total (입력값 * 레버리지)
  const leverageValue = parseInt(leverage) || 1;
  const marginAmount = amount ? parseFloat(amount) : 0;
  const estimatedTotal = marginAmount * leverageValue;

  return (
    <div className="w-full rounded-lg border border-[#1a1a1a] bg-[#0f0f0f] p-4 text-white h-full">
      {/* Buy/Sell Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab("buy")}
          className={`flex-1 py-2.5 text-sm font-bold rounded transition-all ${
            activeTab === "buy"
              ? "bg-[#00FFE0] text-black"
              : "bg-[#141414] border border-[#1f1f1f] text-zinc-400 hover:text-zinc-200 hover:border-[#00FFE0]/30"
          }`}
        >
          Long
        </button>
        <button
          onClick={() => setActiveTab("sell")}
          className={`flex-1 py-2.5 text-sm font-bold rounded transition-all ${
            activeTab === "sell"
              ? "bg-red-600 text-white"
              : "bg-[#141414] border border-[#1f1f1f] text-zinc-400 hover:text-zinc-200 hover:border-red-500/30"
          }`}
        >
          Short
        </button>
      </div>

      <div className="mt-4 space-y-4">
        {/* Balance Display */}
        <div className="flex justify-between items-center px-1">
          <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider">Available Balance</span>
          <div className="flex items-center gap-1.5">
            {DEMO_MODE ? (
              <span className="text-[#00FFE0] font-bold text-sm">{balance.toLocaleString()}</span>
            ) : !walletAddress ? (
              <span className="text-zinc-500 text-sm">--</span>
            ) : isLoadingBalance ? (
              <span className="text-zinc-400 text-sm animate-pulse">Loading...</span>
            ) : (
              <span className="text-[#00FFE0] font-bold text-sm">{balance.toLocaleString()}</span>
            )}
            <span className="text-zinc-500 text-[10px] font-bold">USD</span>
          </div>
        </div>

        {/* Order Type */}
        <div className="flex gap-2">
          <button
            onClick={() => setOrderType("market")}
            className={`flex-1 py-1.5 text-sm rounded transition-all ${
              orderType === "market"
                ? "bg-[#00FFE0]/10 text-[#00FFE0] border border-[#00FFE0]/30"
                : "bg-[#141414] border border-[#1f1f1f] text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Market
          </button>
          <button
            onClick={() => setOrderType("limit")}
            className={`flex-1 py-1.5 text-sm rounded transition-all ${
              orderType === "limit"
                ? "bg-[#00FFE0]/10 text-[#00FFE0] border border-[#00FFE0]/30"
                : "bg-[#141414] border border-[#1f1f1f] text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Limit
          </button>
        </div>

        {/* Margin Type */}
        <div className="flex space-x-2">
          <div className="flex-1">
            <div className="flex justify-between bg-[#141414] border border-[#1f1f1f] rounded p-1">
              <button
                onClick={() => setMarginType("Cross")}
                className={`flex-1 py-1 text-sm rounded transition-all ${
                  marginType === "Cross"
                    ? "bg-[#00FFE0]/10 text-[#00FFE0] border border-[#00FFE0]/30"
                    : "text-zinc-400 hover:bg-[#1a1a1a] hover:text-zinc-200"
                }`}
              >
                Cross
              </button>
              <button
                onClick={() => setMarginType("Isolated")}
                className={`flex-1 py-1 text-sm rounded transition-all ${
                  marginType === "Isolated"
                    ? "bg-[#00FFE0]/10 text-[#00FFE0] border border-[#00FFE0]/30"
                    : "text-zinc-400 hover:bg-[#1a1a1a] hover:text-zinc-200"
                }`}
              >
                Isolated
              </button>
            </div>
          </div>
        </div>

        {/* Leverage */}
        <div>
          <label className="block text-xs text-zinc-400 mb-1">Leverage</label>
          <div className="flex justify-between bg-[#141414] border border-[#1f1f1f] rounded p-1">
            {leverageOptions.map((option) => (
              <button
                key={option}
                onClick={() => setLeverage(option)}
                className={`flex-1 py-1 text-sm rounded transition-all ${
                  leverage === option
                    ? "bg-[#00FFE0]/10 text-[#00FFE0] border border-[#00FFE0]/30"
                    : "text-zinc-400 hover:bg-[#1a1a1a] hover:text-zinc-200"
                }`}
              >
                {option}x
              </button>
            ))}
          </div>
        </div>

        {/* Price (for Limit orders) */}
        {orderType === "limit" && (
          <div>
            <label htmlFor="price" className="block text-xs text-zinc-400 mb-1">
              Price (USD)
            </label>
            <input
              type="text"
              id="price"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder={ticker?.last_price?.toFixed(2) || "0.00"}
              className="w-full bg-[#141414] border border-[#1f1f1f] rounded p-2 text-sm focus:border-[#00FFE0]/50 focus:outline-none focus:ring-1 focus:ring-[#00FFE0]/20 transition-all"
            />
          </div>
        )}

        {orderType === "market" && (
          <div className="bg-[#141414] border border-[#1f1f1f] rounded p-2">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Price (USD)</span>
              <span className="text-white">Market</span>
            </div>
            {ticker && (
              <div className="flex justify-between text-xs mt-1">
                <span className="text-zinc-500">Last price</span>
                <span className="text-[#00FFE0]">
                  ${ticker.last_price.toLocaleString()}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Amount */}
        <div>
          <label htmlFor="amount" className="block text-xs text-zinc-400 mb-1">
            Amount ({quoteAsset})
          </label>
          <div className="relative">
            <input
              type="text"
              id="amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full bg-[#141414] border border-[#1f1f1f] rounded p-2 pr-12 text-sm focus:border-[#00FFE0]/50 focus:outline-none focus:ring-1 focus:ring-[#00FFE0]/20 transition-all"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-zinc-500">
              USD
            </div>
          </div>
          {amount && ticker && (
            <div className="mt-1.5 flex justify-between text-[10px]">
              <span className="text-zinc-500 font-medium">Equiv. to</span>
              <span className="text-[#00FFE0] font-bold">
                {(estimatedTotal / (orderType === "limit" && price ? parseFloat(price) : ticker.last_price)).toFixed(4)} BTC
              </span>
            </div>
          )}
        </div>

        {/* Total */}
        <div className="flex justify-between text-xs text-zinc-400 py-2 border-t border-[#1f1f1f]">
          <span>Estimated Total</span>
          <span className="text-white">
            ${estimatedTotal.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>

        {/* Error Message */}
        {error && (
          <div className="text-red-400 text-xs bg-red-500/10 border border-red-500/30 rounded p-2">
            {error}
          </div>
        )}

        {/* Submit Button */}
        {activeTab === "buy" ? (
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={`w-full font-bold py-2.5 px-4 rounded transition-all ${
              isSubmitting
                ? "bg-zinc-600 text-zinc-400 cursor-not-allowed"
                : "bg-[#00FFE0] hover:bg-[#00FFE0]/90 text-black hover:shadow-[0_0_20px_rgba(0,255,224,0.4)]"
            }`}
          >
            {isSubmitting ? "Placing Order..." : `Buy / Long BTC`}
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={`w-full font-bold py-2.5 px-4 rounded transition-all ${
              isSubmitting
                ? "bg-zinc-600 text-zinc-400 cursor-not-allowed"
                : "bg-red-600 hover:bg-red-700 text-white hover:shadow-[0_0_15px_rgba(239,68,68,0.4)]"
            }`}
          >
            {isSubmitting ? "Placing Order..." : `Sell / Short BTC`}
          </button>
        )}
      </div>
    </div>
  );
};

export default TradePanel;
