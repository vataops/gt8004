"use client";

import React, { useState, useRef, useEffect } from "react";

interface SymbolSelectorProps {
  selectedSymbol: string;
  onSymbolChange: (symbol: string) => void;
}

// Perpetual markets only - no _PERP suffix needed
const AVAILABLE_SYMBOLS = [
  { symbol: "BTC_USD", display: "BTC/USD" },
  { symbol: "ETH_USD", display: "ETH/USD" },
  { symbol: "SOL_USD", display: "SOL/USD" },
];

const SymbolSelector = ({
  selectedSymbol,
  onSymbolChange,
}: SymbolSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentSymbol = AVAILABLE_SYMBOLS.find(
    (s) => s.symbol === selectedSymbol
  );
  const displayName =
    currentSymbol?.display || selectedSymbol.replace(/_USD$/, "");

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (symbol: string) => {
    onSymbolChange(symbol);
    setIsOpen(false);
  };

  return (
    <div className="px-4 py-3 flex items-center">
      <div className="flex items-center gap-4">
        {/* 거래쌍 선택 드롭다운 */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 px-3 py-2 bg-[#141414] hover:bg-[#1a1a1a] border border-[#1f1f1f] hover:border-[#00FFE0]/30 rounded-lg transition-all"
          >
            <span className="text-white font-bold text-lg">{displayName}</span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-[#00FFE0]/10 text-[#00FFE0] border border-[#00FFE0]/30">
              PERP
            </span>
            <svg
              className={`w-4 h-4 text-zinc-400 transition-transform ${
                isOpen ? "rotate-180" : ""
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {/* 드롭다운 메뉴 */}
          {isOpen && (
            <div className="absolute top-full left-0 mt-1 w-64 bg-[#0f0f0f] border border-[#1f1f1f] rounded-lg shadow-xl shadow-black/50 z-50 overflow-hidden">
              <div className="px-3 py-2 text-xs text-[#00FFE0]/70 border-b border-[#1f1f1f] bg-[#00FFE0]/5">
                Perpetual Markets
              </div>
              {AVAILABLE_SYMBOLS.map((item) => (
                <button
                  key={item.symbol}
                  onClick={() => handleSelect(item.symbol)}
                  className={`w-full flex items-center justify-between px-3 py-2 hover:bg-[#00FFE0]/10 transition-colors ${
                    selectedSymbol === item.symbol ? "bg-[#00FFE0]/10" : ""
                  }`}
                >
                  <span className={`${selectedSymbol === item.symbol ? 'text-[#00FFE0]' : 'text-white'}`}>
                    {item.display}
                  </span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-[#00FFE0]/10 text-[#00FFE0] border border-[#00FFE0]/30">
                    PERP
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SymbolSelector;
