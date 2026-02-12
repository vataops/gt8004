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
async function ensureChain(chainId: number) {
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
  return "data:application/json;base64," + btoa(JSON.stringify(obj));
}

interface ServiceEntry {
  endpoint?: string;
  [key: string]: unknown;
}

/**
 * Build a new agentURI with the gateway endpoint replacing the original service endpoint.
 * Preserves all other metadata fields (name, description, etc.).
 */
export function buildGatewayMetadata(currentUri: string, gatewayUrl: string): string | null {
  const meta = decodeDataUri(currentUri);
  if (!meta) return null;

  const services = (meta.services || meta.endpoints) as ServiceEntry[] | undefined;
  if (services?.length) {
    for (const svc of services) {
      if (svc.endpoint) {
        svc.endpoint = gatewayUrl;
      }
    }
  }

  return encodeDataUri(meta);
}

/**
 * Restore the original endpoint in the agentURI (when disabling gateway).
 */
export function restoreOriginalMetadata(currentUri: string, originalEndpoint: string): string | null {
  const meta = decodeDataUri(currentUri);
  if (!meta) return null;

  const services = (meta.services || meta.endpoints) as ServiceEntry[] | undefined;
  if (services?.length) {
    for (const svc of services) {
      if (svc.endpoint) {
        svc.endpoint = originalEndpoint;
      }
    }
  }

  return encodeDataUri(meta);
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
