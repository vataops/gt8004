import { BrowserProvider, getBytes } from "ethers";

export function hasWallet(): boolean {
  return typeof window !== "undefined" && !!window.ethereum;
}

export async function connectWallet(): Promise<string> {
  if (!window.ethereum) throw new Error("No wallet found");
  const provider = new BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  return signer.address;
}

export async function signChallenge(challengeHex: string): Promise<string> {
  if (!window.ethereum) throw new Error("No wallet found");
  const provider = new BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const bytes = getBytes("0x" + challengeHex);
  return signer.signMessage(bytes);
}
