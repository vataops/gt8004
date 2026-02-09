export interface NetworkConfig {
  chainId: number;
  name: string;
  shortName: string;
  rpcUrl: string;
  contractAddress: string;
  blockExplorer: string;
}

export const NETWORKS: Record<string, NetworkConfig> = {
  "base-sepolia": {
    chainId: 84532,
    name: "Base Sepolia",
    shortName: "Base Sepolia",
    rpcUrl: "https://base-sepolia-rpc.publicnode.com",
    contractAddress: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
    blockExplorer: "https://sepolia.basescan.org",
  },
  "ethereum-sepolia": {
    chainId: 11155111,
    name: "Ethereum Sepolia",
    shortName: "Ethereum Sepolia",
    rpcUrl: "https://ethereum-sepolia-rpc.publicnode.com",
    contractAddress: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
    blockExplorer: "https://sepolia.etherscan.io",
  },
};

export const DEFAULT_NETWORK = "base-sepolia";

const IPFS_GATEWAY = "https://w3s.link/ipfs/";

/** Resolve ipfs:// URIs to HTTP gateway URLs. Pass-through for http(s) URLs. */
export function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("ipfs://")) return IPFS_GATEWAY + url.slice(7);
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return null;
}

export const NETWORK_LIST = Object.entries(NETWORKS).map(([key, config]) => ({
  key,
  ...config,
}));
