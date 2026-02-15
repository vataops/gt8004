import { JsonRpcProvider, formatEther } from "ethers";
import { NETWORKS } from "./networks";

// ── Chain → Etherscan API base URL ──

const ETHERSCAN_API_BASES: Record<number, string> = {
  84532: "https://api-sepolia.basescan.org/api",
  11155111: "https://api-sepolia.etherscan.io/api",
};

// ── Chain → RPC URL (from networks config) ──

const CHAIN_RPC: Record<number, string> = {};
for (const cfg of Object.values(NETWORKS)) {
  CHAIN_RPC[cfg.chainId] = cfg.rpcUrl;
}

// ── Types ──

export interface EtherscanTx {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  from: string;
  to: string;
  value: string;
  gas: string;
  gasPrice: string;
  gasUsed: string;
  isError: string;
  txreceipt_status: string;
  functionName: string;
  methodId: string;
  nonce: string;
  contractAddress: string;
  confirmations: string;
  input: string;
}

interface EtherscanApiResponse<T> {
  status: string;
  message: string;
  result: T;
}

export interface OnChainActivity {
  balance: string;
  transactions: EtherscanTx[];
  totalTxCount: number;
  totalGasSpentEth: string;
  totalValueSentEth: string;
  totalValueReceivedEth: string;
  errorCount: number;
  dailyActivity: { date: string; count: number; gasSpent: number }[];
}

// ── Fetch helpers ──

const API_KEY = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY || "";

async function etherscanFetch<T>(
  chainId: number,
  params: Record<string, string>,
): Promise<T> {
  const base = ETHERSCAN_API_BASES[chainId];
  if (!base) throw new Error(`Unsupported chain: ${chainId}`);

  const query = new URLSearchParams(params);
  if (API_KEY) query.set("apikey", API_KEY);

  const res = await fetch(`${base}?${query.toString()}`);
  if (!res.ok) throw new Error(`Etherscan API error: ${res.status}`);

  const data: EtherscanApiResponse<T> = await res.json();

  if (data.status === "0" && data.message !== "No transactions found") {
    throw new Error(data.message || "Etherscan API error");
  }

  return data.result;
}

/** Fetch balance via RPC (no API key needed) */
async function fetchBalanceViaRpc(
  chainId: number,
  address: string,
): Promise<string> {
  const rpc = CHAIN_RPC[chainId];
  if (!rpc) throw new Error(`No RPC for chain ${chainId}`);
  const provider = new JsonRpcProvider(rpc);
  const bal = await provider.getBalance(address);
  return bal.toString();
}

/** Fetch balance: try Etherscan first, fallback to RPC */
async function fetchBalance(
  chainId: number,
  address: string,
): Promise<string> {
  try {
    return await etherscanFetch<string>(chainId, {
      module: "account",
      action: "balance",
      address,
      tag: "latest",
    });
  } catch {
    return fetchBalanceViaRpc(chainId, address);
  }
}

/** Fetch transactions: requires Etherscan API (returns [] on failure) */
async function fetchTransactions(
  chainId: number,
  address: string,
): Promise<EtherscanTx[]> {
  try {
    const result = await etherscanFetch<EtherscanTx[] | string>(chainId, {
      module: "account",
      action: "txlist",
      address,
      startblock: "0",
      endblock: "99999999",
      page: "1",
      offset: "200",
      sort: "desc",
    });
    if (typeof result === "string") return [];
    return result;
  } catch {
    // Etherscan API key required for tx list — return empty
    return [];
  }
}

// ── Main aggregation function ──

export async function fetchOnChainActivity(
  chainId: number,
  address: string,
): Promise<OnChainActivity> {
  const [balanceWei, transactions] = await Promise.all([
    fetchBalance(chainId, address),
    fetchTransactions(chainId, address),
  ]);

  const addr = address.toLowerCase();
  let totalGasSpent = BigInt(0);
  let totalValueSent = BigInt(0);
  let totalValueReceived = BigInt(0);
  let errorCount = 0;

  const dailyMap = new Map<string, { count: number; gasSpent: number }>();

  for (const tx of transactions) {
    const gasUsed = BigInt(tx.gasUsed || "0") * BigInt(tx.gasPrice || "0");
    const value = BigInt(tx.value || "0");

    if (tx.from.toLowerCase() === addr) {
      totalGasSpent += gasUsed;
      totalValueSent += value;
    }
    if ((tx.to || "").toLowerCase() === addr) {
      totalValueReceived += value;
    }
    if (tx.isError === "1") errorCount++;

    const date = new Date(Number(tx.timeStamp) * 1000)
      .toISOString()
      .slice(0, 10);
    const existing = dailyMap.get(date) || { count: 0, gasSpent: 0 };
    existing.count++;
    existing.gasSpent += Number(formatEther(gasUsed));
    dailyMap.set(date, existing);
  }

  const dailyActivity = Array.from(dailyMap.entries())
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    balance: formatEther(balanceWei),
    transactions,
    totalTxCount: transactions.length,
    totalGasSpentEth: formatEther(totalGasSpent),
    totalValueSentEth: formatEther(totalValueSent),
    totalValueReceivedEth: formatEther(totalValueReceived),
    errorCount,
    dailyActivity,
  };
}
