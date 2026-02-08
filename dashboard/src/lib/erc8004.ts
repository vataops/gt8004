import { ethers } from "ethers";

export interface OwnedToken {
  token_id: number;
  agent_uri: string;
}

const ERC8004_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
  "function getAgentURI(uint256 tokenId) view returns (string)",
  "function ownerOf(uint256 tokenId) view returns (address)",
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
