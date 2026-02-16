"use client";

import { useEffect, useState } from "react";
import { marketApi, getWSClient, Trade } from "@/lib/api";

interface TradeHistoryProps {
  symbol?: string;
}

const TradeHistory = ({ symbol = "BTC_USD" }: TradeHistoryProps) => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTrades = async () => {
      try {
        const data = await marketApi.getTrades(symbol);
        setTrades(data);
      } catch (err) {
        console.error("Failed to load trades:", err);
      } finally {
        setLoading(false);
      }
    };

    loadTrades();

    // Subscribe to real-time trades
    const ws = getWSClient();
    ws.connect();

    const unsubscribe = ws.subscribe(`trade.${symbol}`, (data: unknown) => {
      const newTrade = data as Trade;
      setTrades(prev => [newTrade, ...prev.slice(0, 49)]);
    });

    return () => {
      unsubscribe();
    };
  }, [symbol]);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatPrice = (price: number) => {
    return price >= 1000 
      ? price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : price.toFixed(4);
  };

  if (loading) {
    return (
      <div className="w-full text-white h-full flex flex-col">
        <div className="flex justify-between text-sm text-zinc-500 mb-2">
          <span>Price (USD)</span>
          <span>Amount</span>
          <span>Time</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-zinc-500 text-sm animate-pulse">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full text-white h-full flex flex-col">
      <div className="flex justify-between text-sm text-zinc-500 mb-2">
        <span>Price (USD)</span>
        <span>Amount</span>
        <span>Time</span>
      </div>
      <div className="flex flex-col gap-1 flex-grow overflow-auto">
        {trades.length > 0 ? (
          trades.map((trade, index) => (
            <div
              key={`${trade.time}-${index}`}
              className={`flex justify-between text-xs font-mono ${
                trade.side === "Buy" ? "text-[#00FFE0]" : "text-red-500"
              }`}
            >
              <span>{formatPrice(trade.price)}</span>
              <span className="text-zinc-300">{trade.amount.toFixed(4)}</span>
              <span className="text-zinc-500">{formatTime(trade.time)}</span>
            </div>
          ))
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-zinc-600">
              <svg className="w-8 h-8 mx-auto mb-2 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-xs">No trades yet</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TradeHistory;
