"use client";

import { useEffect, useState } from "react";
import { marketApi, getWSClient, Ticker } from "@/lib/api";

// Demo mode flag - set to true to show dummy data for screenshots
const DEMO_MODE = true;

// Demo ticker data for each trading pair (matching chart data)
const DEMO_TICKERS: Record<string, Ticker> = {
  BTC_USD: {
    symbol: "BTC_USD",
    last_price: 95093.42,
    mark_price: 95098.15,
    index_price: 95095.00,
    high_24h: 95892.36,
    low_24h: 94559.12,
    volume_24h: 127.84,
    turnover_24h: 12450000,
    price_change_percent: 0.56,
    funding_rate: 0.0001,
    next_funding_time: Date.now() + 3600000,
    open_interest: 1250.5,
  },
  ETH_USD: {
    symbol: "ETH_USD",
    last_price: 3542.18,
    mark_price: 3543.25,
    index_price: 3542.50,
    high_24h: 3612.45,
    low_24h: 3489.22,
    volume_24h: 2847.32,
    turnover_24h: 10120000,
    price_change_percent: 1.24,
    funding_rate: 0.0001,
    next_funding_time: Date.now() + 3600000,
    open_interest: 8420.3,
  },
  ADA_USD: {
    symbol: "ADA_USD",
    last_price: 1.0847,
    mark_price: 1.0849,
    index_price: 1.0848,
    high_24h: 1.1124,
    low_24h: 1.0612,
    volume_24h: 8542100,
    turnover_24h: 9250000,
    price_change_percent: -0.82,
    funding_rate: 0.0001,
    next_funding_time: Date.now() + 3600000,
    open_interest: 15240000,
  },
  SOL_USD: {
    symbol: "SOL_USD",
    last_price: 187.42,
    mark_price: 187.48,
    index_price: 187.45,
    high_24h: 192.18,
    low_24h: 183.56,
    volume_24h: 45280,
    turnover_24h: 8480000,
    price_change_percent: 2.15,
    funding_rate: 0.0001,
    next_funding_time: Date.now() + 3600000,
    open_interest: 125400,
  },
  XRP_USD: {
    symbol: "XRP_USD",
    last_price: 2.3847,
    mark_price: 2.3852,
    index_price: 2.3850,
    high_24h: 2.4512,
    low_24h: 2.3124,
    volume_24h: 12450000,
    turnover_24h: 29680000,
    price_change_percent: -1.42,
    funding_rate: 0.0001,
    next_funding_time: Date.now() + 3600000,
    open_interest: 45200000,
  },
  DOGE_USD: {
    symbol: "DOGE_USD",
    last_price: 0.3842,
    mark_price: 0.3844,
    index_price: 0.3843,
    high_24h: 0.3978,
    low_24h: 0.3712,
    volume_24h: 142500000,
    turnover_24h: 54780000,
    price_change_percent: 3.28,
    funding_rate: 0.0001,
    next_funding_time: Date.now() + 3600000,
    open_interest: 285000000,
  },
  AVAX_USD: {
    symbol: "AVAX_USD",
    last_price: 38.92,
    mark_price: 38.95,
    index_price: 38.93,
    high_24h: 40.12,
    low_24h: 37.84,
    volume_24h: 284500,
    turnover_24h: 11070000,
    price_change_percent: -0.65,
    funding_rate: 0.0001,
    next_funding_time: Date.now() + 3600000,
    open_interest: 842000,
  },
  DOT_USD: {
    symbol: "DOT_USD",
    last_price: 7.2845,
    mark_price: 7.2862,
    index_price: 7.2850,
    high_24h: 7.4512,
    low_24h: 7.1248,
    volume_24h: 1842000,
    turnover_24h: 13420000,
    price_change_percent: 1.78,
    funding_rate: 0.0001,
    next_funding_time: Date.now() + 3600000,
    open_interest: 5420000,
  },
};

interface MarketInfoProps {
  symbol: string;
}

export default function MarketInfo({ symbol }: MarketInfoProps) {
  const [ticker, setTicker] = useState<Ticker | null>(DEMO_MODE ? DEMO_TICKERS[symbol] || DEMO_TICKERS.BTC_USD : null);
  const [loading, setLoading] = useState(DEMO_MODE ? false : true);

  useEffect(() => {
    // In demo mode, just update ticker when symbol changes
    if (DEMO_MODE) {
      setTicker(DEMO_TICKERS[symbol] || DEMO_TICKERS.BTC_USD);
      return;
    }

    const loadTicker = async () => {
      try {
        const data = await marketApi.getTicker(symbol);
        setTicker(data);
      } catch (err) {
        console.error("Failed to load ticker:", err);
      } finally {
        setLoading(false);
      }
    };

    loadTicker();

    // Subscribe to real-time updates
    const ws = getWSClient();
    ws.connect();

    const unsubscribe = ws.subscribe("ticker", (data: unknown) => {
      const tickerData = data as Ticker;
      if (tickerData.symbol === symbol) {
        setTicker((prev: Ticker | null) => prev ? { ...prev, ...tickerData } : tickerData);
      }
    });

    // Refresh every 30 seconds as backup
    const interval = setInterval(loadTicker, 30000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [symbol]);

  const formatPrice = (value: number | undefined) => {
    if (value === undefined) return "--";
    if (value >= 1000) {
      return value.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
    return value.toFixed(4);
  };

  const formatNumber = (value: number | undefined) => {
    if (value === undefined) return "--";
    if (value >= 1000000) {
      return (value / 1000000).toFixed(2) + "M";
    } else if (value >= 1000) {
      return (value / 1000).toFixed(2) + "K";
    }
    return value.toFixed(2);
  };

  const isPositive = (ticker?.price_change_percent ?? 0) >= 0;

  if (loading) {
    return (
      <div className="px-6 py-2 flex-1 flex items-center">
        <div className="text-zinc-500 text-sm animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="px-6 py-2 flex-1 flex items-center">
      <div className="flex items-center gap-8">
        {/* 현재 가격 */}
        <div className="flex flex-col">
          <span
            className={`text-xl font-bold ${
              isPositive 
                ? "text-[#00FFE0] drop-shadow-[0_0_8px_rgba(0,255,224,0.4)]" 
                : "text-red-500"
            }`}
          >
            ${formatPrice(ticker?.last_price)}
          </span>
          <span className="text-xs text-zinc-500">
            Mark ${formatPrice(ticker?.mark_price)}
          </span>
        </div>

        {/* 구분선 */}
        <div className="h-8 w-px bg-[#1f1f1f]" />

        {/* 24h 변동률 */}
        <div className="flex flex-col">
          <span className="text-[10px] text-zinc-500 uppercase">24h Change</span>
          <span
            className={`text-sm font-medium ${
              isPositive ? "text-[#00FFE0]" : "text-red-500"
            }`}
          >
            {isPositive ? "+" : ""}
            {ticker?.price_change_percent?.toFixed(2) ?? "--"}%
          </span>
        </div>

        {/* 24h 고가 */}
        <div className="flex flex-col">
          <span className="text-[10px] text-zinc-500 uppercase">24h High</span>
          <span className="text-sm text-zinc-200">${formatPrice(ticker?.high_24h)}</span>
        </div>

        {/* 24h 저가 */}
        <div className="flex flex-col">
          <span className="text-[10px] text-zinc-500 uppercase">24h Low</span>
          <span className="text-sm text-zinc-200">${formatPrice(ticker?.low_24h)}</span>
        </div>

        {/* 24h 거래량 */}
        <div className="flex flex-col">
          <span className="text-[10px] text-zinc-500 uppercase">24h Volume</span>
          <span className="text-sm text-zinc-200">
            {formatNumber(ticker?.volume_24h)} {symbol.split("_")[0]}
          </span>
        </div>

        {/* 24h 거래대금 */}
        <div className="flex flex-col">
          <span className="text-[10px] text-zinc-500 uppercase">24h Turnover</span>
          <span className="text-sm text-zinc-200">
            ${formatNumber(ticker?.turnover_24h)}
          </span>
        </div>
      </div>
    </div>
  );
}
