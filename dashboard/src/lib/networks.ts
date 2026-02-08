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
    shortName: "Eth Sepolia",
    rpcUrl: "https://ethereum-sepolia-rpc.publicnode.com",
    contractAddress: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
    blockExplorer: "https://sepolia.etherscan.io",
  },
};

export const DEFAULT_NETWORK = "base-sepolia";

export const NETWORK_LIST = Object.entries(NETWORKS).map(([key, config]) => ({
  key,
  ...config,
}));
