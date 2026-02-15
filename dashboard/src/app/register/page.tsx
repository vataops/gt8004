"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { openApi } from "@/lib/api";
import type { RegisterRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { connectWallet, signChallenge } from "@/lib/wallet";
import { NETWORKS, NETWORK_LIST, DEFAULT_NETWORK } from "@/lib/networks";

export default function RegisterPage() {
  return (
    <Suspense fallback={<p className="text-zinc-500">Loading...</p>}>
      <RegisterPageInner />
    </Suspense>
  );
}

function RegisterPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, walletAddress: storedWallet } = useAuth();

  const [phase, setPhase] = useState<string>("wallet");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isAutoRegistering, setIsAutoRegistering] = useState(false);

  // No form state needed - all data comes from ERC-8004 token metadata

  // Result state
  const [apiKey, setApiKey] = useState("");
  const [registeredAgentId, setRegisteredAgentId] = useState("");
  const [autoRegisterAttempted, setAutoRegisterAttempted] = useState(false);

  // ERC-8004 state
  const [walletAddress, setWalletAddress] = useState("");
  const [ownedTokens, setOwnedTokens] = useState<{ token_id: number; agent_uri: string }[]>([]);
  const [tokensLoading, setTokensLoading] = useState(false);
  const [selectedToken, setSelectedToken] = useState<{ token_id: number; agent_uri: string } | null>(null);
  const [tokenId, setTokenId] = useState("");
  const [selectedNetwork, setSelectedNetwork] = useState(DEFAULT_NETWORK);

  // Auto-populate wallet from auth context
  useEffect(() => {
    if (storedWallet && !walletAddress) {
      setWalletAddress(storedWallet);
    }
  }, [storedWallet, walletAddress]);

  // Auto-select token from query params (coming from My Agents page)
  useEffect(() => {
    const qTokenId = searchParams.get("token_id");
    const qChainId = searchParams.get("chain_id");
    const qAgentUri = searchParams.get("agent_uri");

    // If query params exist, mark as auto-registering
    if (qTokenId && qChainId && !autoRegisterAttempted) {
      setIsAutoRegistering(true);
    }

    if (!qTokenId || !qChainId) return;
    if (!walletAddress) return; // Wait for wallet to be connected
    if (autoRegisterAttempted) return; // Only attempt once

    // Find the network key matching the chain_id
    const chainId = parseInt(qChainId, 10);
    const networkEntry = NETWORK_LIST.find((n) => n.chainId === chainId);
    if (networkEntry) {
      setSelectedNetwork(networkEntry.key);
    }

    // Auto-register the token
    setAutoRegisterAttempted(true);
    const token = { token_id: parseInt(qTokenId, 10), agent_uri: qAgentUri || "" };
    handleSelectToken(token);
  }, [searchParams, walletAddress, autoRegisterAttempted]); // Added dependencies

  // --- Fetch tokens when wallet connects or network changes ---
  useEffect(() => {
    if (!walletAddress) return;

    const network = NETWORKS[selectedNetwork];
    if (!network) return;

    let cancelled = false;
    const fetchTokens = async () => {
      setTokensLoading(true);
      setOwnedTokens([]);
      setError("");
      try {
        // Fetch both on-chain tokens and already registered agents
        const [tokensResp, agentsResp] = await Promise.all([
          openApi.listTokensByOwner(walletAddress, network.chainId),
          openApi.getWalletAgents(walletAddress).catch(() => ({ agents: [] })),
        ]);

        if (cancelled) return;

        // Build set of already registered token IDs for this chain
        const registered = new Set<number>();
        for (const agent of agentsResp.agents || []) {
          if (agent.chain_id === network.chainId && agent.erc8004_token_id != null) {
            registered.add(agent.erc8004_token_id);
          }
        }

        // Filter out already registered tokens
        const unregisteredTokens = (tokensResp.tokens || []).filter(
          (token) => !registered.has(token.token_id)
        );

        setOwnedTokens(unregisteredTokens);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to fetch tokens");
        }
      } finally {
        if (!cancelled) setTokensLoading(false);
      }
    };

    fetchTokens();
    return () => { cancelled = true; };
  }, [walletAddress, selectedNetwork]);

  // --- Step indicator ---
  const getStepInfo = (): { current: number; total: number; label: string } => {
    switch (phase) {
      case "wallet":
        return { current: 1, total: 2, label: "Select Token" };
      case "apikey":
        return { current: 2, total: 2, label: "Complete" };
      default:
        return { current: 1, total: 2, label: "" };
    }
  };

  // --- ERC-8004: Connect wallet ---
  const handleConnectWallet = async () => {
    setError("");
    setLoading(true);
    try {
      const addr = await connectWallet();
      setWalletAddress(addr);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect wallet");
    } finally {
      setLoading(false);
    }
  };

  // --- ERC-8004: Select token and register immediately ---
  const handleSelectToken = async (token: { token_id: number; agent_uri: string }) => {
    setSelectedToken(token);
    setTokenId(String(token.token_id));
    setError("");
    setLoading(true);

    try {
      // Register with just token ID and chain - backend verifies ownership via RPC
      const network = NETWORKS[selectedNetwork];
      const req: RegisterRequest = {
        erc8004_token_id: parseInt(String(token.token_id), 10),
        chain_id: network.chainId,
        wallet_address: walletAddress,
      };
      const res = await openApi.registerAgent(req);
      setApiKey(res.api_key);
      setRegisteredAgentId(res.agent_id);
      setPhase("apikey");
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Registration failed";
      setError(errorMsg);
      setIsAutoRegistering(false); // Reset auto-registering state on error
      console.error("Registration error:", errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Registration is now handled directly in handleSelectToken

  // --- Continue to dashboard ---
  const handleContinue = async () => {
    try {
      await login(apiKey);
      router.push(`/agents/${registeredAgentId}`);
    } catch {
      router.push("/login");
    }
  };

  // --- Copy to clipboard helper ---
  const [copied, setCopied] = useState("");
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(""), 2000);
  };

  const stepInfo = getStepInfo();
  const currentNetwork = NETWORKS[selectedNetwork];

  return (
    <div className="max-w-lg mx-auto">
      {/* Step Indicator */}
      {phase !== "apikey" && (
        <div className="mb-6">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Step {stepInfo.current} of {stepInfo.total}</span>
            <span>{stepInfo.label}</span>
          </div>
        </div>
      )}

      {/* ===== Success Phase: SDK Setup Guide ===== */}
      {phase === "apikey" && (
        <div className="max-w-2xl mx-auto">
          {/* Success Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-900/30 border border-green-800 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold mb-2">Agent Registered Successfully!</h2>
            <p className="text-sm text-zinc-400">
              Your agent <span className="text-white font-mono">{registeredAgentId}</span> is ready to integrate.
            </p>
          </div>

          {/* SDK Setup Instructions */}
          <div className="space-y-6">
            {/* Step 1: Install SDK */}
            <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-lg p-5">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Step 1: Install SDK</h3>
              <div className="bg-[#0a0a0a] rounded-md p-3 border border-[#1a1a1a] relative group">
                <code className="text-sm font-mono text-gray-300">
                  pip install gt8004-sdk
                </code>
                <button
                  onClick={() => copyToClipboard("pip install gt8004-sdk", "install")}
                  className="absolute top-2 right-2 px-2 py-1 rounded bg-[#1a1a1a] hover:bg-[#00FFE0]/10 hover:text-[#00FFE0] text-xs text-zinc-400 opacity-0 group-hover:opacity-100 transition-all"
                >
                  {copied === "install" ? "Copied!" : "Copy"}
                </button>
              </div>
              <p className="text-xs text-zinc-600 mt-2">
                Note: SDK is coming soon. For now, use the manual Ingest API.
              </p>
            </div>

            {/* Step 2: Integration Code */}
            <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-lg p-5">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Step 2: Add to Your Agent Code</h3>
              <div className="bg-[#0a0a0a] rounded-md p-3 border border-[#1a1a1a] relative group">
                <pre className="text-xs font-mono text-gray-300 overflow-x-auto">
{`from gt8004 import GT8004Logger

logger = GT8004Logger(
    agent_id="${registeredAgentId}",
    api_key="${apiKey}"
)

# FastAPI example
from fastapi import FastAPI
app = FastAPI()

@app.middleware("http")
async def gt8004_middleware(request, call_next):
    return await logger.middleware(request, call_next)`}
                </pre>
                <button
                  onClick={() => copyToClipboard(`from gt8004 import GT8004Logger

logger = GT8004Logger(
    agent_id="${registeredAgentId}",
    api_key="${apiKey}"
)

# FastAPI example
from fastapi import FastAPI
app = FastAPI()

@app.middleware("http")
async def gt8004_middleware(request, call_next):
    return await logger.middleware(request, call_next)`, "code")}
                  className="absolute top-2 right-2 px-2 py-1 rounded bg-[#1a1a1a] hover:bg-[#00FFE0]/10 hover:text-[#00FFE0] text-xs text-zinc-400 opacity-0 group-hover:opacity-100 transition-all"
                >
                  {copied === "code" ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            {/* Step 3: API Key */}
            <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-lg p-5">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Your API Key</h3>
              <div className="bg-[#0a0a0a] rounded-md p-3 border border-[#1a1a1a] relative group">
                <code className="text-sm font-mono text-gray-300 break-all">
                  {apiKey}
                </code>
                <button
                  onClick={() => copyToClipboard(apiKey, "apikey")}
                  className="absolute top-2 right-2 px-2 py-1 rounded bg-[#1a1a1a] hover:bg-[#00FFE0]/10 hover:text-[#00FFE0] text-xs text-zinc-400 opacity-0 group-hover:opacity-100 transition-all"
                >
                  {copied === "apikey" ? "Copied!" : "Copy"}
                </button>
              </div>
              <p className="text-xs text-red-400 mt-2">
                ⚠️ Save this key securely. It won&apos;t be shown again.
              </p>
            </div>

            {/* Continue Button */}
            <button
              onClick={handleContinue}
              className="w-full py-3 rounded-md bg-[#00FFE0] text-black text-sm font-medium hover:shadow-[0_0_20px_rgba(0,255,224,0.4)] transition-all"
            >
              Continue to Dashboard →
            </button>
          </div>
        </div>
      )}

      {/* Phase: Wallet + Token Selection */}
      {phase === "wallet" && (
        <>
          {/* Auto-registering loading state */}
          {isAutoRegistering ? (
            <div className="py-20 text-center">
              <div className="inline-block w-12 h-12 border-4 border-[#00FFE0] border-t-transparent rounded-full animate-spin mb-4" />
              <h2 className="text-xl font-bold mb-2">Registering Agent...</h2>
              <p className="text-sm text-zinc-400">
                Please wait while we register your agent to GT8004.
              </p>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold mb-2">Register New Agent</h2>
              <p className="text-sm text-zinc-400 mb-4">
                Connect your wallet to register your ERC-8004 agents to GT8004.
              </p>

          {/* Network Selector */}
          <div className="mb-4">
            <label className="block text-xs text-zinc-500 mb-1.5">Network</label>
            <div className="flex gap-2">
              {NETWORK_LIST.map((net) => (
                <button
                  key={net.key}
                  type="button"
                  onClick={() => setSelectedNetwork(net.key)}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    selectedNetwork === net.key
                      ? "bg-[#00FFE0]/10 border-[#00FFE0]/30 text-[#00FFE0]"
                      : "bg-[#0f0f0f] border-[#1f1f1f] text-zinc-400 hover:border-zinc-500"
                  }`}
                >
                  {net.shortName}
                </button>
              ))}
            </div>
            {currentNetwork && (
              <p className="mt-1.5 text-xs text-zinc-600 font-mono truncate">
                {currentNetwork.contractAddress}
              </p>
            )}
          </div>

          {!walletAddress ? (
            <>
              <button
                onClick={handleConnectWallet}
                disabled={loading}
                className="w-full py-2 rounded-md bg-[#00FFE0] text-black text-sm font-medium disabled:opacity-50 hover:shadow-[0_0_20px_rgba(0,255,224,0.4)] transition-all"
              >
                {loading ? "Connecting..." : "Connect Wallet"}
              </button>
              {error && (
                <p className="text-sm text-red-400 mt-4">{error}</p>
              )}
            </>
          ) : (
            <>
              {/* Connected address */}
              <div className="p-3 rounded-lg border border-[#1f1f1f] bg-[#0f0f0f] mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-500">Connected</p>
                  <p className="text-sm font-mono text-gray-300">
                    {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                  </p>
                </div>
                <span className="w-2 h-2 rounded-full bg-green-500" />
              </div>

              {/* Token list */}
              {tokensLoading ? (
                <div className="py-12 text-center">
                  <div className="inline-block w-6 h-6 border-2 border-[#00FFE0] border-t-transparent rounded-full animate-spin mb-3" />
                  <p className="text-sm text-zinc-400">Loading tokens from {currentNetwork?.shortName}...</p>
                </div>
              ) : ownedTokens.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs text-zinc-500 mb-2">
                    {ownedTokens.length} unregistered agent{ownedTokens.length !== 1 ? "s" : ""} found on {currentNetwork?.shortName}
                  </p>
                  {ownedTokens.map((token) => (
                    <button
                      key={token.token_id}
                      onClick={() => handleSelectToken(token)}
                      className="w-full text-left p-4 rounded-lg border border-[#1f1f1f] bg-[#0f0f0f] hover:border-[#00FFE0]/50 hover:bg-[#00FFE0]/5 transition-colors group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-white">
                              Token #{token.token_id}
                            </span>
                          </div>
                          {token.agent_uri ? (
                            <p className="text-xs font-mono text-zinc-400 truncate">
                              {token.agent_uri}
                            </p>
                          ) : (
                            <p className="text-xs text-zinc-600 italic">No agent URI set</p>
                          )}
                        </div>
                        <span className="text-zinc-600 group-hover:text-[#00FFE0] transition-colors ml-3">
                          &rarr;
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <p className="text-sm text-zinc-400 mb-2">No unregistered agents</p>
                  <p className="text-xs text-zinc-600">
                    All your ERC-8004 tokens on {currentNetwork?.shortName} are already registered,
                    or you don&apos;t own any tokens yet. Mint a new token to register more agents.
                  </p>
                </div>
              )}

              {error && (
                <p className="text-sm text-red-400 mt-4">{error}</p>
              )}
            </>
          )}
          </>
          )}
        </>
      )}

      {/* Config phase removed - registration happens immediately after token selection */}
    </div>
  );
}
