export interface NetworkConfig {
  chainId: number;
  name: string;
  shortName: string;
  rpcUrl: string;
  contractAddress: string;
  reputationAddress: string;
  blockExplorer: string;
}

const TESTNET_NETWORKS: Record<string, NetworkConfig> = {
  "base-sepolia": {
    chainId: 84532,
    name: "Base Sepolia",
    shortName: "Base Sepolia",
    rpcUrl: "https://base-sepolia-rpc.publicnode.com",
    contractAddress: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
    reputationAddress: "0x8004B663056A597Dffe9eCcC1965A193B7388713",
    blockExplorer: "https://sepolia.basescan.org",
  },
  "ethereum-sepolia": {
    chainId: 11155111,
    name: "Ethereum Sepolia",
    shortName: "Ethereum Sepolia",
    rpcUrl: "https://ethereum-sepolia-rpc.publicnode.com",
    contractAddress: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
    reputationAddress: "",
    blockExplorer: "https://sepolia.etherscan.io",
  },
};

const MAINNET_NETWORKS: Record<string, NetworkConfig> = {
  ethereum: {
    chainId: 1,
    name: "Ethereum",
    shortName: "Ethereum",
    rpcUrl: "https://ethereum-rpc.publicnode.com",
    contractAddress: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
    reputationAddress: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63",
    blockExplorer: "https://etherscan.io",
  },
};

const isMainnet = process.env.NEXT_PUBLIC_NETWORK_MODE === "mainnet";

export const NETWORKS: Record<string, NetworkConfig> = isMainnet
  ? MAINNET_NETWORKS
  : TESTNET_NETWORKS;

export const DEFAULT_NETWORK = isMainnet ? "ethereum" : "base-sepolia";

const IPFS_GATEWAY = "https://w3s.link/ipfs/";

/** Resolve ipfs:// URIs to HTTP gateway URLs. Pass-through for http(s) URLs. */
export function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("ipfs://")) return IPFS_GATEWAY + url.slice(7);
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return null;
}

/** Extract image URL from on-chain agentURI metadata JSON. */
export function parseAgentURIImage(uri: string | undefined | null): string {
  if (!uri) return "";
  let json: string | null = null;
  if (uri.startsWith("data:application/json;base64,")) {
    try { json = atob(uri.slice("data:application/json;base64,".length)); } catch { return ""; }
  } else if (uri.startsWith("data:application/json,")) {
    json = uri.slice("data:application/json,".length);
  } else if (uri.startsWith("{")) {
    json = uri;
  }
  if (!json) return "";
  try { return (JSON.parse(json) as { image?: string }).image || ""; } catch { return ""; }
}

export const NETWORK_LIST = Object.entries(NETWORKS).map(([key, config]) => ({
  key,
  ...config,
}));
