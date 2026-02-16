"use client";

import { useState, useEffect } from "react";
import { configApi, ContractConfig } from "@/lib/api";

// UTxO info for statistics
interface UtxoInfo {
  txHash: string;
  outputIndex: number;
  lovelace: number;
  assets: { unit: string; quantity: number }[];
  datum?: string;
}

interface ScriptStats {
  address: string;
  hash: string;
  utxoCount: number;
  totalAda: number;
  totalUsdm: number;
  utxos: UtxoInfo[];
}

export default function StatsPage() {
  const [contractConfig, setContractConfig] = useState<ContractConfig | null>(null);
  const [vaultStats, setVaultStats] = useState<ScriptStats | null>(null);
  const [positionStats, setPositionStats] = useState<ScriptStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatUSD = (num: number | undefined) => {
    if (num === undefined || num === 0) return "0";
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  // Load statistics data (UTxOs from both scripts)
  const loadStats = async () => {
    setStatsLoading(true);
    setError(null);
    try {
      const config = await configApi.getContractConfig();
      console.log("Loaded config:", config);
      setContractConfig(config);

      // Use Blockfrost settings from environment variables
      const BLOCKFROST_URL = process.env.NEXT_PUBLIC_BLOCKFROST_URL || "https://cardano-preview.blockfrost.io/api/v0";
      const BLOCKFROST_KEY = process.env.NEXT_PUBLIC_BLOCKFROST_API_KEY || "";

      // Helper to fetch UTxOs from an address
      const fetchUtxos = async (address: string): Promise<UtxoInfo[]> => {
        try {
          console.log("Fetching UTxOs for address:", address);
          const response = await fetch(`${BLOCKFROST_URL}/addresses/${address}/utxos`, {
            headers: { project_id: BLOCKFROST_KEY },
          });
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`Blockfrost error for ${address}:`, response.status, errorText);
            return [];
          }
          const utxos = await response.json();
          console.log(`Found ${utxos.length} UTxOs for ${address.slice(0, 20)}...`);
          return utxos.map((u: { tx_hash: string; output_index: number; amount: { unit: string; quantity: string }[]; inline_datum?: string }) => ({
            txHash: u.tx_hash,
            outputIndex: u.output_index,
            lovelace: parseInt(u.amount.find((a: { unit: string }) => a.unit === "lovelace")?.quantity || "0"),
            assets: u.amount
              .filter((a: { unit: string }) => a.unit !== "lovelace")
              .map((a: { unit: string; quantity: string }) => ({ unit: a.unit, quantity: parseInt(a.quantity) })),
            datum: u.inline_datum,
          }));
        } catch (err) {
          console.error(`Failed to fetch UTxOs for ${address}:`, err);
          return [];
        }
      };

      // Fetch vault UTxOs
      if (config.vault_script_addr) {
        const vaultUtxos = await fetchUtxos(config.vault_script_addr);
        const usdmUnit = config.usdm_policy_id + config.usdm_asset_name;
        setVaultStats({
          address: config.vault_script_addr,
          hash: config.vault_script_hash || "",
          utxoCount: vaultUtxos.length,
          totalAda: vaultUtxos.reduce((sum, u) => sum + u.lovelace, 0) / 1_000_000,
          totalUsdm: vaultUtxos.reduce((sum, u) => {
            const usdm = u.assets.find(a => a.unit === usdmUnit);
            return sum + (usdm?.quantity || 0);
          }, 0),
          utxos: vaultUtxos,
        });
      }

      // Fetch position UTxOs
      if (config.position_script_addr) {
        const positionUtxos = await fetchUtxos(config.position_script_addr);
        const usdmUnit = config.usdm_policy_id + config.usdm_asset_name;
        setPositionStats({
          address: config.position_script_addr,
          hash: config.position_script_hash || "",
          utxoCount: positionUtxos.length,
          totalAda: positionUtxos.reduce((sum, u) => sum + u.lovelace, 0) / 1_000_000,
          totalUsdm: positionUtxos.reduce((sum, u) => {
            const usdm = u.assets.find(a => a.unit === usdmUnit);
            return sum + (usdm?.quantity || 0);
          }, 0),
          utxos: positionUtxos,
        });
      }
    } catch (err) {
      console.error("Failed to load stats:", err);
      // Try to show a more helpful error message
      if (err instanceof Error && err.message.includes("API Error")) {
        setError("Backend API might not be running. Make sure the gateway service is up.");
      } else {
        setError(err instanceof Error ? err.message : "Failed to load statistics");
      }
    } finally {
      setStatsLoading(false);
    }
  };

  // Load stats on mount
  useEffect(() => {
    loadStats();
  }, []);

  return (
    <div className="bg-[#0a0a0a] font-sans h-full overflow-auto">
      <div className="p-4 flex flex-col gap-4 max-w-7xl mx-auto">
        {/* Dev Mode Banner */}
        <div className="bg-yellow-500/10 border border-yellow-500/30 border-dashed rounded-lg p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-yellow-500 text-sm font-medium">Development Statistics</p>
            <p className="text-yellow-500/70 text-xs">On-chain data for debugging and monitoring. Not for production use.</p>
          </div>
          <button
            onClick={loadStats}
            disabled={statsLoading}
            className="px-4 py-2 text-sm bg-yellow-500/20 text-yellow-500 rounded-lg border border-yellow-500/30 hover:bg-yellow-500/30 transition-colors disabled:opacity-50"
          >
            {statsLoading ? "Loading..." : "Refresh"}
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-red-500 text-sm font-medium">Error Loading Data</p>
              <p className="text-red-500/70 text-xs">{error}</p>
            </div>
          </div>
        )}

        {/* Contract Configuration */}
        <div className="bg-[#0f0f0f] border border-dashed border-yellow-500/30 rounded-lg p-4">
          <h3 className="text-yellow-500 text-sm font-medium mb-3 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Contract Configuration
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
            <div className="bg-[#0a0a0a] rounded p-3">
              <span className="text-zinc-500 block mb-1">Network</span>
              <span className="text-zinc-300">{contractConfig?.network || "--"}</span>
            </div>
            <div className="bg-[#0a0a0a] rounded p-3">
              <span className="text-zinc-500 block mb-1">USD Policy ID</span>
              <span className="text-zinc-300 break-all text-[10px]">{contractConfig?.usdm_policy_id || "--"}</span>
            </div>
            <div className="bg-[#0a0a0a] rounded p-3">
              <span className="text-zinc-500 block mb-1">Vault Script Hash</span>
              <span className="text-zinc-300 break-all text-[10px]">{contractConfig?.vault_script_hash || "--"}</span>
            </div>
            <div className="bg-[#0a0a0a] rounded p-3">
              <span className="text-zinc-500 block mb-1">Position Script Hash</span>
              <span className="text-zinc-300 break-all text-[10px]">{contractConfig?.position_script_hash || "--"}</span>
            </div>
          </div>
        </div>

        {/* Platform Summary */}
        <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-lg p-4">
          <h3 className="text-white text-sm font-medium mb-3">Platform Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#0a0a0a] rounded-lg p-4 border border-[#1f1f1f]">
              <p className="text-zinc-500 text-xs mb-1">Total Value Locked</p>
              <p className="text-white text-2xl font-bold">
                {formatUSD((vaultStats?.totalUsdm || 0) + (positionStats?.totalUsdm || 0))}
                <span className="text-sm font-normal text-zinc-400 ml-1">USD</span>
              </p>
            </div>
            <div className="bg-[#0a0a0a] rounded-lg p-4 border border-[#1f1f1f]">
              <p className="text-zinc-500 text-xs mb-1">Vault Liquidity</p>
              <p className="text-[#00FFE0] text-2xl font-bold">
                {formatUSD(vaultStats?.totalUsdm)}
                <span className="text-sm font-normal text-zinc-400 ml-1">USD</span>
              </p>
            </div>
            <div className="bg-[#0a0a0a] rounded-lg p-4 border border-[#1f1f1f]">
              <p className="text-zinc-500 text-xs mb-1">Position Collateral</p>
              <p className="text-purple-400 text-2xl font-bold">
                {formatUSD(positionStats?.totalUsdm)}
                <span className="text-sm font-normal text-zinc-400 ml-1">USD</span>
              </p>
            </div>
            <div className="bg-[#0a0a0a] rounded-lg p-4 border border-[#1f1f1f]">
              <p className="text-zinc-500 text-xs mb-1">Utilization Rate</p>
              <p className="text-white text-2xl font-bold">
                {vaultStats?.totalUsdm && positionStats?.totalUsdm
                  ? ((positionStats.totalUsdm / (vaultStats.totalUsdm + positionStats.totalUsdm)) * 100).toFixed(1)
                  : "--"}
                <span className="text-sm font-normal text-zinc-400 ml-1">%</span>
              </p>
            </div>
          </div>
        </div>

        {/* Two Column Layout for Scripts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Vault Script Stats */}
          <div className="bg-[#0f0f0f] border border-dashed border-[#00FFE0]/30 rounded-lg p-4">
            <h3 className="text-[#00FFE0] text-sm font-medium mb-3 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Vault Script
            </h3>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-[#0a0a0a] rounded p-3 border border-[#00FFE0]/10">
                <p className="text-zinc-500 text-xs">UTxO Count</p>
                <p className="text-[#00FFE0] text-xl font-bold">{vaultStats?.utxoCount ?? "--"}</p>
              </div>
              <div className="bg-[#0a0a0a] rounded p-3 border border-[#00FFE0]/10">
                <p className="text-zinc-500 text-xs">Total ADA</p>
                <p className="text-white text-xl font-bold">{vaultStats?.totalAda?.toFixed(2) ?? "--"}</p>
              </div>
              <div className="bg-[#0a0a0a] rounded p-3 border border-[#00FFE0]/10">
                <p className="text-zinc-500 text-xs">Total USD</p>
                <p className="text-[#00FFE0] text-xl font-bold">{formatUSD(vaultStats?.totalUsdm)}</p>
              </div>
              <div className="bg-[#0a0a0a] rounded p-3 border border-[#00FFE0]/10">
                <p className="text-zinc-500 text-xs">Script Hash</p>
                <p className="text-zinc-400 text-[10px] font-mono truncate">{vaultStats?.hash ?? "--"}</p>
              </div>
            </div>

            <div className="text-xs font-mono bg-[#0a0a0a] rounded p-2 mb-3">
              <span className="text-zinc-500">Address:</span>{" "}
              <a
                href={`https://preview.cardanoscan.io/address/${vaultStats?.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#00FFE0] hover:underline break-all"
              >
                {vaultStats?.address || "--"}
              </a>
            </div>

            {/* Vault UTxO List */}
            {vaultStats?.utxos && vaultStats.utxos.length > 0 ? (
              <div className="border border-[#1f1f1f] rounded overflow-hidden">
                <div className="bg-[#141414] px-3 py-2 text-xs text-zinc-400 border-b border-[#1f1f1f]">
                  UTxO Details ({vaultStats.utxos.length})
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {vaultStats.utxos.map((utxo) => (
                    <div key={`${utxo.txHash}#${utxo.outputIndex}`} className="px-3 py-2 text-xs border-b border-[#1f1f1f]/50 hover:bg-[#141414]">
                      <div className="flex justify-between items-center">
                        <a
                          href={`https://preview.cardanoscan.io/transaction/${utxo.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#00FFE0] hover:underline font-mono"
                        >
                          {utxo.txHash.slice(0, 12)}...#{utxo.outputIndex}
                        </a>
                        <div className="text-right">
                          <span className="text-zinc-400">{(utxo.lovelace / 1_000_000).toFixed(2)} ADA</span>
                          {utxo.assets.length > 0 && (
                            <span className="ml-2 text-[#00FFE0]">
                              +{utxo.assets.length} asset{utxo.assets.length > 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center text-zinc-500 py-4 text-sm border border-[#1f1f1f] rounded">
                No vault UTxOs found
              </div>
            )}
          </div>

          {/* Position Script Stats */}
          <div className="bg-[#0f0f0f] border border-dashed border-purple-500/30 rounded-lg p-4">
            <h3 className="text-purple-400 text-sm font-medium mb-3 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Position Script
            </h3>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-[#0a0a0a] rounded p-3 border border-purple-500/10">
                <p className="text-zinc-500 text-xs">Open Positions</p>
                <p className="text-purple-400 text-xl font-bold">{positionStats?.utxoCount ?? "--"}</p>
              </div>
              <div className="bg-[#0a0a0a] rounded p-3 border border-purple-500/10">
                <p className="text-zinc-500 text-xs">Total ADA Locked</p>
                <p className="text-white text-xl font-bold">{positionStats?.totalAda?.toFixed(2) ?? "--"}</p>
              </div>
              <div className="bg-[#0a0a0a] rounded p-3 border border-purple-500/10">
                <p className="text-zinc-500 text-xs">Total Collateral</p>
                <p className="text-purple-400 text-xl font-bold">{formatUSD(positionStats?.totalUsdm)}</p>
              </div>
              <div className="bg-[#0a0a0a] rounded p-3 border border-purple-500/10">
                <p className="text-zinc-500 text-xs">Script Hash</p>
                <p className="text-zinc-400 text-[10px] font-mono truncate">{positionStats?.hash ?? "--"}</p>
              </div>
            </div>

            <div className="text-xs font-mono bg-[#0a0a0a] rounded p-2 mb-3">
              <span className="text-zinc-500">Address:</span>{" "}
              <a
                href={`https://preview.cardanoscan.io/address/${positionStats?.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-400 hover:underline break-all"
              >
                {positionStats?.address || "--"}
              </a>
            </div>

            {/* Position UTxO List */}
            {positionStats?.utxos && positionStats.utxos.length > 0 ? (
              <div className="border border-[#1f1f1f] rounded overflow-hidden">
                <div className="bg-[#141414] px-3 py-2 text-xs text-zinc-400 border-b border-[#1f1f1f]">
                  Position UTxOs ({positionStats.utxos.length})
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {positionStats.utxos.map((utxo) => (
                    <div key={`${utxo.txHash}#${utxo.outputIndex}`} className="px-3 py-2 text-xs border-b border-[#1f1f1f]/50 hover:bg-[#141414]">
                      <div className="flex justify-between items-center">
                        <a
                          href={`https://preview.cardanoscan.io/transaction/${utxo.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-purple-400 hover:underline font-mono"
                        >
                          {utxo.txHash.slice(0, 12)}...#{utxo.outputIndex}
                        </a>
                        <div className="text-right">
                          <span className="text-zinc-400">{(utxo.lovelace / 1_000_000).toFixed(2)} ADA</span>
                          {utxo.assets.length > 0 && (
                            <span className="ml-2 text-purple-400">
                              +{utxo.assets.length} asset{utxo.assets.length > 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center text-zinc-500 py-4 text-sm border border-[#1f1f1f] rounded">
                No open positions
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
