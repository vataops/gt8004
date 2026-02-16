"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { connectLace, getLucid } from "@/lucid-lace";
import { configApi, tradingApi, txBuilderApi } from "@/lib/api";

export interface OpenPositionParams {
  symbol: string;
  side: "Long" | "Short";
  entryPrice: number;
  amount: number;       // BTC amount
  collateral: number;   // USDM amount
  leverage: number;
}

export interface ClosePositionParams {
  positionId: string;
  symbol: string;       // e.g., "BTC" for oracle price lookup
  side?: 'Long' | 'Short';  // Position side (for logging)
  // UTxO reference for exact matching
  txHash: string;       // Transaction hash where position was created
  outputIndex: number;  // Output index in that transaction
}

export interface ClosePositionResult {
  txHash: string;
  closePrice: number;
  realizedPnl: number;
  pnlPercent: number;
}

export interface VaultDepositResult {
  txHash: string;
  amount: number;
  shares: number;
}

export interface VaultWithdrawResult {
  txHash: string;
  amount: number;
  sharesBurned: number;
}

interface WalletContextType {
  walletAddress: string | null;
  network: string | null;
  isConnecting: boolean;
  isLaceAvailable: boolean;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  openPosition: (params: OpenPositionParams) => Promise<string>;
  closePosition: (params: ClosePositionParams) => Promise<ClosePositionResult>;
  depositToVault: (amount: number) => Promise<VaultDepositResult>;
  withdrawFromVault: (shares: number) => Promise<VaultWithdrawResult>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [network, setNetwork] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLaceAvailable, setIsLaceAvailable] = useState(false);

  // Check if Lace wallet is installed and auto-reconnect if previously connected
  useEffect(() => {
    const checkWalletAvailability = async () => {
      if (typeof window !== "undefined" && window.cardano?.lace) {
        setIsLaceAvailable(true);

        // Check if we should auto-reconnect
        const wasConnected = localStorage.getItem("hydrox_wallet_connected");
        if (wasConnected === "true" && !walletAddress && !isConnecting) {
          console.log("Auto-reconnecting wallet...");
          try {
            const result = await connectLace();
            setWalletAddress(result.address);
            setNetwork(result.network);
            console.log("Auto-reconnected:", result.address);
          } catch (err) {
            console.error("Auto-reconnect failed:", err);
            // Clear the flag if auto-reconnect fails
            localStorage.removeItem("hydrox_wallet_connected");
          }
        }
        return true;
      }
      return false;
    };

    // Check immediately
    checkWalletAvailability();

    // Lace may take time to inject, check multiple times with increasing delays
    const delays = [100, 300, 500, 1000, 2000, 3000];
    const timeoutIds: ReturnType<typeof setTimeout>[] = [];

    delays.forEach((delay) => {
      timeoutIds.push(setTimeout(() => {
        checkWalletAvailability();
      }, delay));
    });

    // Also set up an interval as fallback (but stop after wallet is found)
    const intervalId = setInterval(() => {
      if (isLaceAvailable) {
        clearInterval(intervalId);
        return;
      }
      checkWalletAvailability();
    }, 2000);

    return () => {
      timeoutIds.forEach(clearTimeout);
      clearInterval(intervalId);
    };
  }, [walletAddress, isConnecting, isLaceAvailable]);

  const connectWallet = useCallback(async () => {
    if (!isLaceAvailable) {
      throw new Error("Lace wallet is not installed. Please install Lace wallet extension.");
    }

    setIsConnecting(true);

    try {
      // Use Lucid to connect and get bech32 address
      const result = await connectLace();
      setWalletAddress(result.address);
      setNetwork(result.network);
      // Save connection state to localStorage for auto-reconnect on page refresh
      localStorage.setItem("hydrox_wallet_connected", "true");
    } catch (error: unknown) {
      console.error("Error connecting wallet:", error);
      const err = error as { code?: number; message?: string };
      if (err.code === 4001 || err.message?.includes("reject")) {
        throw new Error("Wallet connection was rejected.");
      } else if (err.message?.includes("timeout")) {
        throw new Error("Connection timeout. Please try again.");
      } else if (err.message?.includes("Blockfrost")) {
        throw new Error("Blockfrost configuration error. Please check settings.");
      } else {
        throw new Error(err.message || "Failed to connect wallet");
      }
    } finally {
      setIsConnecting(false);
    }
  }, [isLaceAvailable]);

  const disconnectWallet = useCallback(() => {
    setWalletAddress(null);
    setNetwork(null);
    // Clear auto-reconnect flag
    localStorage.removeItem("hydrox_wallet_connected");
  }, []);

  // Open position - TX built by backend, signed locally
  const openPosition = useCallback(async (params: OpenPositionParams): Promise<string> => {
    const lucid = getLucid();
    if (!lucid || !walletAddress) {
      throw new Error("Wallet not connected. Please connect your wallet first.");
    }

    try {
      console.log("Building OpenPosition TX via backend...");

      // 1. Call backend to build the transaction
      const response = await txBuilderApi.buildOpenPosition({
        wallet_address: walletAddress,
        symbol: params.symbol,
        side: params.side,
        entry_price: params.entryPrice,
        amount: params.amount,
        collateral: params.collateral,
        leverage: params.leverage,
      });

      if (!response.success || !response.tx_cbor) {
        throw new Error(response.error || "Failed to build transaction");
      }

      console.log("TX built by backend, signing...");
      console.log("  Output index:", response.output_index);
      console.log("  Fee:", response.fee);

      // 2. Deserialize the TX from CBOR and sign with wallet
      const tx = lucid.fromTx(response.tx_cbor);
      const signedTx = await tx.sign.withWallet().complete();
      const txHash = await signedTx.submit();

      console.log("Transaction submitted:", txHash);

      // 3. Save position to DB after successful on-chain submission
      const outputIndex = response.output_index ?? 0;
      try {
        await tradingApi.createPosition({
          address: walletAddress,
          symbol: params.symbol,
          side: params.side,
          entry_price: params.entryPrice,
          amount: params.amount,
          collateral: params.collateral,
          leverage: params.leverage,
          tx_hash: txHash,
          output_index: outputIndex,
        });
        console.log("Position saved to DB with UTxO reference");
      } catch (dbError) {
        console.error("Failed to save position to DB:", dbError);
        // Don't throw - TX already succeeded on-chain
      }

      return txHash;
    } catch (error) {
      console.error("Error opening position:", error);
      throw error;
    }
  }, [walletAddress]);

  // Close position - TX built by backend with oracle price, signed locally
  const closePosition = useCallback(async (params: ClosePositionParams): Promise<ClosePositionResult> => {
    const lucid = getLucid();
    if (!lucid || !walletAddress) {
      throw new Error("Wallet not connected. Please connect your wallet first.");
    }

    try {
      console.log("Building ClosePosition TX via backend...");
      console.log("  Position:", params.positionId);
      console.log("  UTxO:", params.txHash, "#", params.outputIndex);

      // 1. Call backend to build the transaction (includes oracle price fetch)
      const response = await txBuilderApi.buildClosePosition({
        wallet_address: walletAddress,
        position_tx_hash: params.txHash,
        position_output_index: params.outputIndex,
        symbol: params.symbol,
        side: params.side || 'Long',
      });

      if (!response.success || !response.tx_cbor) {
        throw new Error(response.error || "Failed to build transaction");
      }

      console.log("TX built by backend, signing...");
      console.log("  Oracle price:", response.oracle_price);
      console.log("  PnL:", response.is_profit ? "+" : "-", response.pnl_amount);
      console.log("  Trader receives:", response.trader_receives);

      // 2. Deserialize the TX from CBOR and sign with wallet
      const tx = lucid.fromTx(response.tx_cbor);
      const signedTx = await tx.sign.withWallet().complete();
      const txHash = await signedTx.submit();

      console.log("Transaction submitted:", txHash);

      // 3. Update backend DB after successful on-chain close
      try {
        await tradingApi.closePosition(params.positionId, walletAddress);
        console.log("Position marked as closed in DB");
      } catch (dbError) {
        console.error("Failed to update position in DB:", dbError);
      }

      // Calculate close result
      const oraclePrice = response.oracle_price || 0;
      const closePrice = oraclePrice / 1_000_000; // Convert from scaled price
      const realizedPnl = response.pnl_amount || 0;
      const traderReceives = response.trader_receives || 0;
      const collateralEstimate = traderReceives - (response.is_profit ? realizedPnl : -realizedPnl);
      const pnlPercent = collateralEstimate > 0 ? (realizedPnl / collateralEstimate) * 100 : 0;

      const closeResult: ClosePositionResult = {
        txHash,
        closePrice,
        realizedPnl: response.is_profit ? realizedPnl : -realizedPnl,
        pnlPercent: response.is_profit ? pnlPercent : -pnlPercent,
      };

      console.log("Position closed successfully:", closeResult);
      return closeResult;
    } catch (error) {
      console.error("Error closing position:", error);
      throw error;
    }
  }, [walletAddress]);

  // Deposit USDM to Vault - TX built by backend, signed locally
  const depositToVault = useCallback(async (amount: number): Promise<VaultDepositResult> => {
    const lucid = getLucid();
    if (!lucid || !walletAddress) {
      throw new Error("Wallet not connected. Please connect your wallet first.");
    }

    try {
      console.log("Building Deposit TX via backend...");
      console.log("  Amount:", amount, "USDM");

      // 1. Call backend to build the transaction
      const response = await txBuilderApi.buildDeposit({
        wallet_address: walletAddress,
        amount,
      });

      if (!response.success || !response.tx_cbor) {
        throw new Error(response.error || "Failed to build transaction");
      }

      console.log("TX built by backend, signing...");
      console.log("  Shares to receive:", response.shares_to_receive);
      console.log("  Is initial deposit:", response.is_initial_deposit);

      // 2. Deserialize the TX from CBOR and sign with wallet
      const tx = lucid.fromTx(response.tx_cbor);
      const signedTx = await tx.sign.withWallet().complete();
      const txHash = await signedTx.submit();

      console.log("Vault deposit submitted:", txHash);

      return {
        txHash,
        amount,
        shares: response.shares_to_receive || amount, // 1:1 for initial deposit
      };
    } catch (error) {
      console.error("Error depositing to vault:", error);
      throw error;
    }
  }, [walletAddress]);

  // Withdraw USDM from Vault - TX built by backend, signed locally
  const withdrawFromVault = useCallback(async (shares: number): Promise<VaultWithdrawResult> => {
    const lucid = getLucid();
    if (!lucid || !walletAddress) {
      throw new Error("Wallet not connected. Please connect your wallet first.");
    }

    try {
      console.log("Building Withdraw TX via backend...");
      console.log("  Shares:", shares);

      // 1. Call backend to build the transaction
      const response = await txBuilderApi.buildWithdraw({
        wallet_address: walletAddress,
        shares,
      });

      if (!response.success || !response.tx_cbor) {
        throw new Error(response.error || "Failed to build transaction");
      }

      console.log("TX built by backend, signing...");
      console.log("  USDM to receive:", response.usdm_to_receive);
      console.log("  Is full withdrawal:", response.is_full_withdrawal);

      // 2. Deserialize the TX from CBOR and sign with wallet
      const tx = lucid.fromTx(response.tx_cbor);
      const signedTx = await tx.sign.withWallet().complete();
      const txHash = await signedTx.submit();

      console.log("Vault withdrawal submitted:", txHash);

      return {
        txHash,
        amount: response.usdm_to_receive || 0,
        sharesBurned: shares,
      };
    } catch (error) {
      console.error("Error withdrawing from vault:", error);
      throw error;
    }
  }, [walletAddress]);

  return (
    <WalletContext.Provider
      value={{
        walletAddress,
        network,
        isConnecting,
        isLaceAvailable,
        connectWallet,
        disconnectWallet,
        openPosition,
        closePosition,
        depositToVault,
        withdrawFromVault,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}
