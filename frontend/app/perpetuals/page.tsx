"use client";

import { useState, useRef, useEffect } from "react";
import Chart from "@/components/Chart";
import TradePanel from "@/components/TradePanel";
import MarketInfo from "@/components/MarketInfo";
import BottomPanel from "@/components/BottomPanel";
import { useWallet } from "@/contexts/WalletContext";

// Available trading pairs
const TRADING_PAIRS = [
  { symbol: "BTC_USD", name: "BTC/USD", base: "BTC" },
  { symbol: "ETH_USD", name: "ETH/USD", base: "ETH" },
  { symbol: "ADA_USD", name: "ADA/USD", base: "ADA" },
  { symbol: "SOL_USD", name: "SOL/USD", base: "SOL" },
  { symbol: "XRP_USD", name: "XRP/USD", base: "XRP" },
  { symbol: "DOGE_USD", name: "DOGE/USD", base: "DOGE" },
  { symbol: "AVAX_USD", name: "AVAX/USD", base: "AVAX" },
  { symbol: "DOT_USD", name: "DOT/USD", base: "DOT" },
];

export default function PerpetualsPage() {
  const [symbol, setSymbol] = useState("BTC_USD");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { walletAddress } = useWallet();

  const currentPair = TRADING_PAIRS.find(p => p.symbol === symbol) || TRADING_PAIRS[0];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div
      className="bg-[#0a0a0a] font-sans h-full flex flex-col"
      style={{ overflowY: "overlay" }}
    >
      <div id="exchange" className="p-4 flex flex-col gap-3">
        {/* 시장 정보 */}
        <div className="flex items-stretch bg-[#0f0f0f] border border-[#1a1a1a] rounded-lg shrink-0">
          {/* Symbol Selector Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="px-4 py-3 flex items-center gap-2 border-r border-[#1f1f1f] hover:bg-[#1a1a1a] transition-colors"
            >
              <span className="text-white font-bold text-lg">{currentPair.name}</span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-[#00FFE0]/10 text-[#00FFE0] border border-[#00FFE0]/30">
                PERP
              </span>
              <svg
                className={`w-4 h-4 text-zinc-400 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-48 bg-[#0f0f0f] border border-[#1a1a1a] rounded-lg shadow-xl z-50 overflow-hidden">
                {TRADING_PAIRS.map((pair) => (
                  <button
                    key={pair.symbol}
                    onClick={() => {
                      setSymbol(pair.symbol);
                      setIsDropdownOpen(false);
                    }}
                    className={`w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-[#1a1a1a] transition-colors ${
                      symbol === pair.symbol ? "bg-[#00FFE0]/10 text-[#00FFE0]" : "text-white"
                    }`}
                  >
                    <span className="font-medium">{pair.name}</span>
                    {symbol === pair.symbol && (
                      <svg className="w-4 h-4 text-[#00FFE0]" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          <MarketInfo symbol={symbol} />
        </div>

        <main className="w-full flex h-[600px] gap-3">
          {/* 차트 - Trade History 제거로 인해 더 넓게 */}
          <div className="w-3/4 h-full">
            <Chart symbol={symbol} />
          </div>
          {/* 거래 패널 */}
          <div className="w-1/4 h-full">
            <TradePanel symbol={symbol} walletAddress={walletAddress} />
          </div>
        </main>

        {/* 하단 패널: 포지션, 주문, 잔고 */}
        <div className="shrink-0">
          <BottomPanel />
        </div>
      </div>
    </div>
  );
}
