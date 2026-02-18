import { ethers } from "ethers";
import { NETWORKS } from "./networks";

export interface OwnedToken {
  token_id: number;
  agent_uri: string;
}

const ERC8004_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
  "function getAgentURI(uint256 tokenId) view returns (string)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function setAgentURI(uint256 tokenId, string uri)",
  "function register(string agentURI) external returns (uint256)",
  "event AgentRegistered(uint256 indexed tokenId, address indexed wallet, string agentURI)",
];

/**
 * Query ERC-8004 tokens owned by an address using tokenOfOwnerByIndex (ERC721Enumerable).
 */
export async function getTokensByOwner(
  rpcUrl: string,
  contractAddress: string,
  ownerAddress: string
): Promise<OwnedToken[]> {
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const contract = new ethers.Contract(contractAddress, ERC8004_ABI, provider);

  const balance = await contract.balanceOf(ownerAddress);
  const count = Number(balance);
  if (count === 0) return [];

  const cap = Math.min(count, 100);
  const tokens: OwnedToken[] = [];

  for (let i = 0; i < cap; i++) {
    try {
      const tokenId = await contract.tokenOfOwnerByIndex(ownerAddress, i);
      let agentUri = "";
      try {
        agentUri = await contract.getAgentURI(tokenId);
      } catch {
        // Token may not have a URI set
      }
      tokens.push({
        token_id: Number(tokenId),
        agent_uri: agentUri,
      });
    } catch {
      continue;
    }
  }

  return tokens;
}

/** Find network config by chain ID. */
function networkByChainId(chainId: number) {
  return Object.values(NETWORKS).find((n) => n.chainId === chainId);
}

/**
 * Switch the user's wallet to the required chain. Throws if rejected.
 */
export async function ensureChain(chainId: number) {
  if (!window.ethereum) throw new Error("No wallet found");
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x" + chainId.toString(16) }],
    });
  } catch (err: unknown) {
    const code = (err as { code?: number }).code;
    if (code === 4902) {
      const net = networkByChainId(chainId);
      if (!net) throw new Error(`Unknown chain ${chainId}`);
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: "0x" + chainId.toString(16),
          chainName: net.name,
          rpcUrls: [net.rpcUrl],
          blockExplorerUrls: [net.blockExplorer],
        }],
      });
    } else {
      throw err;
    }
  }
}

/**
 * Call setAgentURI on the ERC-8004 contract via MetaMask.
 * Returns the transaction hash.
 */
export async function updateAgentURI(
  chainId: number,
  tokenId: number,
  newUri: string,
): Promise<string> {
  const net = networkByChainId(chainId);
  if (!net) throw new Error(`Unsupported chain: ${chainId}`);

  await ensureChain(chainId);

  const provider = new ethers.BrowserProvider(window.ethereum!);
  const signer = await provider.getSigner();
  const contract = new ethers.Contract(net.contractAddress, ERC8004_ABI, signer);

  const tx = await contract.setAgentURI(tokenId, newUri);
  await tx.wait();
  return tx.hash;
}

/**
 * Mint a new ERC-8004 agent token via MetaMask.
 * Calls register(agentURI) and returns the token ID from the AgentRegistered event.
 */
export async function registerNewAgent(
  chainId: number,
  agentUri: string,
): Promise<{ tokenId: number; txHash: string }> {
  const net = networkByChainId(chainId);
  if (!net) throw new Error(`Unsupported chain: ${chainId}`);

  await ensureChain(chainId);

  const provider = new ethers.BrowserProvider(window.ethereum!);
  const signer = await provider.getSigner();
  const contract = new ethers.Contract(net.contractAddress, ERC8004_ABI, signer);

  const tx = await contract.register(agentUri);
  const receipt = await tx.wait();

  // Parse AgentRegistered event to get tokenId
  const iface = new ethers.Interface(ERC8004_ABI);
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
      if (parsed?.name === "AgentRegistered") {
        return { tokenId: Number(parsed.args.tokenId), txHash: tx.hash };
      }
    } catch {
      continue;
    }
  }

  // Fallback: check for Transfer event (ERC-721 mint)
  const transferTopic = ethers.id("Transfer(address,address,uint256)");
  for (const log of receipt.logs) {
    if (log.topics[0] === transferTopic && log.topics.length >= 3) {
      const tokenId = Number(BigInt(log.topics[3]));
      return { tokenId, txHash: tx.hash };
    }
  }

  throw new Error("Transaction succeeded but token ID could not be extracted from events");
}

/** Decode a data:application/json;base64,... URI into a JSON object. */
export function decodeDataUri(uri: string): Record<string, unknown> | null {
  if (uri.startsWith("data:application/json;base64,")) {
    try {
      return JSON.parse(atob(uri.slice("data:application/json;base64,".length)));
    } catch { return null; }
  }
  if (uri.startsWith("data:application/json,")) {
    try {
      return JSON.parse(decodeURIComponent(uri.slice("data:application/json,".length)));
    } catch { return null; }
  }
  if (uri.startsWith("{")) {
    try { return JSON.parse(uri); } catch { return null; }
  }
  return null;
}

/** Encode a JSON object back to data:application/json;base64,... */
export function encodeDataUri(obj: Record<string, unknown>): string {
  // btoa cannot handle non-Latin1 characters (e.g. Korean, emoji).
  // Encode via TextEncoder → binary string to support full Unicode.
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return "data:application/json;base64," + btoa(binary);
}

interface ServiceEntry {
  endpoint?: string;
  [key: string]: unknown;
}

/**
 * Build updated metadata with A2A endpoint added when services array is empty.
 * Returns null if services already exist or metadata can't be decoded.
 */
export function buildA2AServiceMetadata(currentUri: string, a2aEndpoint: string): string | null {
  const meta = decodeDataUri(currentUri);
  if (!meta) return null;

  const services = (meta.services || meta.endpoints) as ServiceEntry[] | undefined;
  if (services && services.length > 0) return null;

  meta.services = [{ name: "a2a", endpoint: a2aEndpoint }];

  return encodeDataUri(meta);
}
