"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { openApi } from "@/lib/api";
import { NETWORK_LIST } from "@/lib/networks";

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      isMetaMask?: boolean;
    };
  }
}

interface TokenInfo {
  token_id: number;
  agent_uri: string;
}

interface NetworkTokens {
  networkKey: string;
  networkName: string;
  chainId: number;
  tokens: TokenInfo[];
  loading: boolean;
  error?: string;
}

export default function LoginPage() {
  const { login, walletLogin, connectWallet, walletAddress: storedWallet, agent, loading: authLoading } = useAuth();
  const router = useRouter();

  // Redirect if already connected
  useEffect(() => {
    if (!authLoading && (agent || storedWallet)) {
      router.replace("/my-agents");
    }
  }, [authLoading, agent, storedWallet, router]);

  // Wallet state
  const [walletAddress, setWalletAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Token scan state (shown after wallet verification)
  const [networkTokens, setNetworkTokens] = useState<NetworkTokens[]>([]);
  const [verified, setVerified] = useState(false);

  // API key login state
  const [showApiKey, setShowApiKey] = useState(false);
  const [key, setKey] = useState("");
  const [keyError, setKeyError] = useState("");
  const [keyLoading, setKeyLoading] = useState(false);

  const scanNetworks = async (address: string) => {
    const initial: NetworkTokens[] = NETWORK_LIST.map((n) => ({
      networkKey: n.key,
      networkName: n.name,
      chainId: n.chainId,
      tokens: [],
      loading: true,
    }));
    setNetworkTokens(initial);

    // Query all networks via backend API in parallel
    const results = await Promise.allSettled(
      NETWORK_LIST.map(async (n) => {
        const resp = await openApi.listTokensByOwner(address, n.chainId);
        return { key: n.key, tokens: resp.tokens || [] };
      })
    );

    setNetworkTokens((prev) =>
      prev.map((nt) => {
        const result = results.find((_, i) => NETWORK_LIST[i].key === nt.networkKey);
        if (!result) return { ...nt, loading: false };
        if (result.status === "fulfilled") {
          return { ...nt, tokens: result.value.tokens, loading: false };
        }
        const reason = result.status === "rejected" && result.reason instanceof Error
          ? result.reason.message
          : "Unknown error";
        return { ...nt, loading: false, error: reason };
      })
    );
  };

  const connectSignAndScan = async () => {
    setError("");
    setLoading(true);
    setNetworkTokens([]);
    setVerified(false);

    try {
      if (!window.ethereum) {
        setError("MetaMask not detected. Please install MetaMask.");
        return;
      }

      // 1. Connect wallet
      const accounts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];
      if (!accounts || accounts.length === 0) {
        setError("No accounts found.");
        return;
      }
      const address = accounts[0];
      setWalletAddress(address);

      // 2. Get challenge and sign to verify ownership
      const { challenge } = await openApi.getChallenge(address);
      const signature = (await window.ethereum.request({
        method: "personal_sign",
        params: ["0x" + challenge, address],
      })) as string;

      // 3. Try wallet-login (will succeed if agent already registered)
      try {
        const result = await openApi.walletLogin(address, challenge, signature);
        walletLogin(result.api_key, result.agent, address);
      } catch {
        // No agent registered — wallet-only mode
        connectWallet(address);
      }

      // 4. Always redirect to My Agents after wallet verification
      router.push("/my-agents");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Wallet login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleApiKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setKeyError("");
    setKeyLoading(true);

    try {
      await login(key.trim());
      router.push("/my-agents");
    } catch {
      setKeyError("Invalid API key. Please check and try again.");
    } finally {
      setKeyLoading(false);
    }
  };

  const totalTokens = networkTokens.reduce((sum, nt) => sum + nt.tokens.length, 0);
  const allDone = networkTokens.length > 0 && networkTokens.every((nt) => !nt.loading);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-full max-w-md">
        <h2 className="text-xl font-bold mb-2">Agent Login</h2>
        <p className="text-sm text-gray-500 mb-6">
          Connect and sign with your wallet to verify ownership.
        </p>

        {/* Connect + Sign Button */}
        <button
          onClick={connectSignAndScan}
          disabled={loading}
          className="w-full px-4 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            "Verifying..."
          ) : (
            <>
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="6" width="20" height="14" rx="2" />
                <path d="M16 14h2" />
                <path d="M2 10h20" />
              </svg>
              {walletAddress && verified
                ? `Verified: ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
                : "Connect & Sign"}
            </>
          )}
        </button>

        {error && (
          <p className="mt-2 text-sm text-red-400">{error}</p>
        )}

        {/* Network Token Scan Results (shown after signature verification) */}
        {verified && networkTokens.length > 0 && (
          <div className="mt-4 space-y-3">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              ERC-8004 Tokens by Network
            </h3>

            {networkTokens.map((nt) => (
              <div
                key={nt.networkKey}
                className="border border-gray-800 rounded-lg p-3 bg-gray-900/50"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{nt.networkName}</span>
                  <span className="text-xs text-gray-500">Chain {nt.chainId}</span>
                </div>

                {nt.loading ? (
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="inline-block w-3 h-3 border-2 border-gray-600 border-t-orange-500 rounded-full animate-spin" />
                    Scanning...
                  </div>
                ) : nt.error ? (
                  <p className="text-xs text-red-400">{nt.error}</p>
                ) : nt.tokens.length === 0 ? (
                  <p className="text-xs text-gray-600">No tokens found</p>
                ) : (
                  <div className="space-y-1.5">
                    {nt.tokens.map((t) => (
                      <div
                        key={t.token_id}
                        className="flex items-center justify-between text-xs bg-gray-800/50 rounded px-2 py-1.5"
                      >
                        <span className="text-orange-400 font-mono">
                          Token #{t.token_id}
                        </span>
                        {t.agent_uri && (
                          <span className="text-gray-400 truncate ml-2 max-w-[200px]">
                            {t.agent_uri}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Summary */}
            {allDone && (
              <p className="text-xs text-gray-500 mt-2">
                {totalTokens > 0
                  ? `Found ${totalTokens} token${totalTokens > 1 ? "s" : ""} across ${networkTokens.filter((nt) => nt.tokens.length > 0).length} network${networkTokens.filter((nt) => nt.tokens.length > 0).length > 1 ? "s" : ""}. No agent registered in the platform yet — go to Register Agent.`
                  : "No ERC-8004 tokens found on any network. Register an agent first."}
              </p>
            )}
          </div>
        )}

        {/* Divider */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 border-t border-gray-700" />
          <button
            onClick={() => setShowApiKey(!showApiKey)}
            className="text-xs text-gray-500 hover:text-gray-400 transition-colors"
          >
            {showApiKey ? "Hide" : "Use API Key instead"}
          </button>
          <div className="flex-1 border-t border-gray-700" />
        </div>

        {/* API Key Login */}
        {showApiKey && (
          <form onSubmit={handleApiKeySubmit} className="space-y-4">
            <div>
              <label
                htmlFor="apiKey"
                className="block text-xs text-gray-400 mb-1"
              >
                API Key
              </label>
              <input
                id="apiKey"
                type="password"
                placeholder="gt8004_sk_..."
                value={key}
                onChange={(e) => setKey(e.target.value)}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            {keyError && (
              <p className="text-sm text-red-400">{keyError}</p>
            )}

            <button
              type="submit"
              disabled={keyLoading || !key.trim()}
              className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-md text-sm font-medium transition-colors"
            >
              {keyLoading ? "Verifying..." : "Login with API Key"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
