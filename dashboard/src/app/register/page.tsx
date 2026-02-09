"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { openApi, fetchScanAgent } from "@/lib/api";
import type { RegisterRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { connectWallet, signChallenge } from "@/lib/wallet";
import { NETWORKS, NETWORK_LIST, DEFAULT_NETWORK } from "@/lib/networks";

const CATEGORIES = ["compute", "data", "inference", "storage", "other"];
const PROTOCOLS = ["a2a", "mcp", "x402", "custom"];

export default function RegisterPage() {
  return (
    <Suspense fallback={<p className="text-gray-500">Loading...</p>}>
      <RegisterPageInner />
    </Suspense>
  );
}

function RegisterPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, walletAddress: storedWallet } = useAuth();

  const [mode, setMode] = useState<"basic" | "erc8004">("erc8004");
  const [phase, setPhase] = useState<string>("wallet");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Form state (shared)
  const [name, setName] = useState("");
  const [originEndpoint, setOriginEndpoint] = useState("");
  const [category, setCategory] = useState("compute");
  const [protocols, setProtocols] = useState<string[]>([]);
  const [showPricing, setShowPricing] = useState(false);
  const [pricingModel, setPricingModel] = useState("per_request");
  const [pricingAmount, setPricingAmount] = useState("");
  const [pricingCurrency, setPricingCurrency] = useState("USDC");

  // Result state
  const [apiKey, setApiKey] = useState("");
  const [registeredAgentId, setRegisteredAgentId] = useState("");

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

    if (!qTokenId || !qChainId) return;

    // Find the network key matching the chain_id
    const chainId = parseInt(qChainId, 10);
    const networkEntry = NETWORK_LIST.find((n) => n.chainId === chainId);
    if (networkEntry) {
      setSelectedNetwork(networkEntry.key);
    }

    // Auto-select the token and jump to config phase
    const token = { token_id: parseInt(qTokenId, 10), agent_uri: qAgentUri || "" };
    setSelectedToken(token);
    setTokenId(qTokenId);

    // Pre-populate origin endpoint from agent URI
    if (token.agent_uri) {
      setOriginEndpoint(token.agent_uri);
    }

    // Fetch name from 8004scan
    fetchScanAgent(chainId, token.token_id).then((scanAgent) => {
      if (scanAgent?.name) {
        setName(scanAgent.name);
      }
    });

    setPhase("config");
  }, [searchParams]);

  const toggleProtocol = (p: string) => {
    setProtocols((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  const handleModeSwitch = (newMode: "basic" | "erc8004") => {
    if (newMode === mode) return;
    setMode(newMode);
    setError("");
    if (newMode === "basic") {
      setPhase("form");
    } else {
      setPhase("wallet");
    }
  };

  // --- Fetch tokens when wallet connects or network changes ---
  useEffect(() => {
    if (!walletAddress || mode !== "erc8004") return;

    const network = NETWORKS[selectedNetwork];
    if (!network) return;

    let cancelled = false;
    const fetchTokens = async () => {
      setTokensLoading(true);
      setOwnedTokens([]);
      setError("");
      try {
        const resp = await openApi.listTokensByOwner(walletAddress, network.chainId);
        if (!cancelled) {
          setOwnedTokens(resp.tokens || []);
        }
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
  }, [walletAddress, mode, selectedNetwork]);

  // --- Step indicator ---
  const getStepInfo = (): { current: number; total: number; label: string } => {
    if (mode === "basic") {
      if (phase === "form") return { current: 1, total: 2, label: "Registration" };
      return { current: 2, total: 2, label: "Complete" };
    }
    switch (phase) {
      case "wallet":
        return { current: 1, total: 3, label: "Select Token" };
      case "config":
        return { current: 2, total: 3, label: "Configure Agent" };
      case "apikey":
        return { current: 3, total: 3, label: "Complete" };
      default:
        return { current: 1, total: 3, label: "" };
    }
  };

  // --- Basic mode: Register ---
  const handleBasicRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const req: RegisterRequest = {
        name: name || undefined,
        origin_endpoint: originEndpoint,
        category,
        protocols: protocols.length > 0 ? protocols : undefined,
      };
      if (showPricing && pricingAmount) {
        req.pricing = {
          model: pricingModel,
          amount: parseFloat(pricingAmount),
          currency: pricingCurrency,
        };
      }
      const res = await openApi.registerAgent(req);
      setApiKey(res.api_key);
      setRegisteredAgentId(res.agent_id);
      setPhase("apikey");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
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

  // --- ERC-8004: Select token and proceed ---
  const handleSelectToken = async (token: { token_id: number; agent_uri: string }) => {
    setSelectedToken(token);
    setTokenId(String(token.token_id));
    setError("");

    // Pre-populate origin endpoint from agent URI
    if (token.agent_uri) {
      setOriginEndpoint(token.agent_uri);
    }

    // Fetch name from 8004scan
    const network = NETWORKS[selectedNetwork];
    if (network) {
      const scanAgent = await fetchScanAgent(network.chainId, token.token_id);
      if (scanAgent?.name) {
        setName(scanAgent.name);
      }
    }

    setPhase("config");
  };

  // --- ERC-8004: Register with token ---
  const handleERC8004Register = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { challenge } = await openApi.getChallenge(walletAddress);
      const signature = await signChallenge(challenge);

      const network = NETWORKS[selectedNetwork];
      const req: RegisterRequest = {
        name: name || undefined,
        origin_endpoint: originEndpoint,
        category,
        protocols: protocols.length > 0 ? protocols : undefined,
        erc8004_token_id: parseInt(tokenId, 10),
        chain_id: network.chainId,
        wallet_address: walletAddress,
        challenge,
        signature,
      };
      if (showPricing && pricingAmount) {
        req.pricing = {
          model: pricingModel,
          amount: parseFloat(pricingAmount),
          currency: pricingCurrency,
        };
      }
      const res = await openApi.registerAgent(req);
      setApiKey(res.api_key);
      setRegisteredAgentId(res.agent_id);
      setPhase("apikey");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  // --- Continue to dashboard ---
  const handleContinue = async () => {
    try {
      await login(apiKey);
      router.push("/my-agents");
    } catch {
      router.push("/login");
    }
  };

  const stepInfo = getStepInfo();
  const currentNetwork = NETWORKS[selectedNetwork];

  // --- Shared form fields ---
  const renderFormFields = (showName = true) => (
    <>
      {showName && (
        <div>
          <label className="block text-sm text-gray-400 mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Agent"
            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
          />
        </div>
      )}

      <div>
        <label className="block text-sm text-gray-400 mb-1">Origin Endpoint *</label>
        <input
          type="url"
          value={originEndpoint}
          onChange={(e) => setOriginEndpoint(e.target.value)}
          required
          placeholder="https://api.example.com"
          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">Category</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-sm text-white focus:outline-none focus:border-blue-500"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">Protocols</label>
        <div className="flex flex-wrap gap-2">
          {PROTOCOLS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => toggleProtocol(p)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                protocols.includes(p)
                  ? "bg-blue-600 border-blue-500 text-white"
                  : "bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500"
              }`}
            >
              {p.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={() => setShowPricing(!showPricing)}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          {showPricing ? "- Hide Pricing" : "+ Add Pricing"}
        </button>
        {showPricing && (
          <div className="mt-2 space-y-2 p-3 rounded-lg border border-gray-800 bg-gray-900/50">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Model</label>
                <select
                  value={pricingModel}
                  onChange={(e) => setPricingModel(e.target.value)}
                  className="w-full px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-xs text-white"
                >
                  <option value="per_request">Per Request</option>
                  <option value="per_token">Per Token</option>
                  <option value="flat">Flat</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Amount</label>
                <input
                  type="number"
                  step="0.0001"
                  value={pricingAmount}
                  onChange={(e) => setPricingAmount(e.target.value)}
                  placeholder="0.01"
                  className="w-full px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-xs text-white placeholder-gray-600"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Currency</label>
                <select
                  value={pricingCurrency}
                  onChange={(e) => setPricingCurrency(e.target.value)}
                  className="w-full px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-xs text-white"
                >
                  <option value="USDC">USDC</option>
                  <option value="ETH">ETH</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );

  // --- Success phase (shared) ---
  const renderSuccessPhase = () => (
    <div className="max-w-lg mx-auto text-center">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-900/30 border border-green-800 flex items-center justify-center">
        <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2 className="text-xl font-bold mb-2">Agent Registered</h2>
      <p className="text-sm text-gray-400 mb-6">
        Your agent <span className="text-white font-medium">{registeredAgentId}</span> has been
        successfully registered. You can manage it from your agent dashboard.
      </p>

      <button
        onClick={handleContinue}
        className="w-full py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
      >
        Go to Dashboard
      </button>
    </div>
  );

  return (
    <div className="max-w-lg mx-auto">
      {/* Mode Toggle */}
      {phase !== "apikey" && (
        <div className="mb-6">
          <div className="flex rounded-lg overflow-hidden border border-gray-700">
            <button
              onClick={() => handleModeSwitch("erc8004")}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                mode === "erc8004"
                  ? "bg-purple-600 text-white"
                  : "bg-gray-900 text-gray-400 hover:text-gray-200"
              }`}
            >
              With ERC-8004
            </button>
            <button
              onClick={() => handleModeSwitch("basic")}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                mode === "basic"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-900 text-gray-400 hover:text-gray-200"
              }`}
            >
              Basic
            </button>
          </div>

          {/* Step Indicator */}
          <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
            <span>Step {stepInfo.current} of {stepInfo.total}</span>
            <span>{stepInfo.label}</span>
          </div>
        </div>
      )}

      {/* ===== Success Phase (shared) ===== */}
      {phase === "apikey" && renderSuccessPhase()}

      {/* ===== BASIC MODE ===== */}
      {mode === "basic" && phase === "form" && (
        <>
          <h2 className="text-xl font-bold mb-6">Register Agent</h2>
          <form onSubmit={handleBasicRegister} className="space-y-4">
            {renderFormFields()}

            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {loading ? "Registering..." : "Register Agent"}
            </button>
          </form>
        </>
      )}

      {/* ===== ERC-8004 MODE ===== */}

      {/* Phase: Wallet + Token Selection */}
      {mode === "erc8004" && phase === "wallet" && (
        <>
          <h2 className="text-xl font-bold mb-2">Select Your Agent</h2>
          <p className="text-sm text-gray-400 mb-4">
            Connect your wallet to see your registered ERC-8004 agents.
          </p>

          {/* Network Selector */}
          <div className="mb-4">
            <label className="block text-xs text-gray-500 mb-1.5">Network</label>
            <div className="flex gap-2">
              {NETWORK_LIST.map((net) => (
                <button
                  key={net.key}
                  type="button"
                  onClick={() => setSelectedNetwork(net.key)}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    selectedNetwork === net.key
                      ? "bg-purple-600/20 border-purple-500 text-purple-300"
                      : "bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500"
                  }`}
                >
                  {net.shortName}
                </button>
              ))}
            </div>
            {currentNetwork && (
              <p className="mt-1.5 text-xs text-gray-600 font-mono truncate">
                {currentNetwork.contractAddress}
              </p>
            )}
          </div>

          {!walletAddress ? (
            <>
              <button
                onClick={handleConnectWallet}
                disabled={loading}
                className="w-full py-2 rounded-md bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium disabled:opacity-50 transition-colors"
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
              <div className="p-3 rounded-lg border border-gray-700 bg-gray-900/50 mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">Connected</p>
                  <p className="text-sm font-mono text-gray-300">
                    {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                  </p>
                </div>
                <span className="w-2 h-2 rounded-full bg-green-500" />
              </div>

              {/* Token list */}
              {tokensLoading ? (
                <div className="py-12 text-center">
                  <div className="inline-block w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mb-3" />
                  <p className="text-sm text-gray-400">Loading tokens from {currentNetwork?.shortName}...</p>
                </div>
              ) : ownedTokens.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 mb-2">
                    {ownedTokens.length} agent{ownedTokens.length !== 1 ? "s" : ""} found on {currentNetwork?.shortName}
                  </p>
                  {ownedTokens.map((token) => (
                    <button
                      key={token.token_id}
                      onClick={() => handleSelectToken(token)}
                      className="w-full text-left p-4 rounded-lg border border-gray-700 bg-gray-900/50 hover:border-purple-500 hover:bg-purple-900/10 transition-colors group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-white">
                              Token #{token.token_id}
                            </span>
                          </div>
                          {token.agent_uri ? (
                            <p className="text-xs font-mono text-gray-400 truncate">
                              {token.agent_uri}
                            </p>
                          ) : (
                            <p className="text-xs text-gray-600 italic">No agent URI set</p>
                          )}
                        </div>
                        <span className="text-gray-600 group-hover:text-purple-400 transition-colors ml-3">
                          &rarr;
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <p className="text-sm text-gray-400 mb-2">No ERC-8004 agents found</p>
                  <p className="text-xs text-gray-600">
                    This wallet doesn&apos;t own any ERC-8004 tokens on {currentNetwork?.shortName}.
                    You can register with Basic mode or mint a token at{" "}
                    <span className="text-purple-400">8004scan.io</span>
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

      {/* Phase: Config */}
      {mode === "erc8004" && phase === "config" && (
        <>
          <h2 className="text-xl font-bold mb-2">Configure Agent</h2>
          {selectedToken && (
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs px-2 py-1 rounded bg-purple-900/50 border border-purple-700 text-purple-300">
                Token #{selectedToken.token_id}
              </span>
              <span className="text-xs px-2 py-1 rounded bg-gray-800 border border-gray-700 text-gray-400">
                {currentNetwork?.shortName}
              </span>
              <button
                onClick={() => {
                  setPhase("wallet");
                  setSelectedToken(null);
                  setError("");
                }}
                className="text-xs text-gray-500 hover:text-gray-300"
              >
                Change
              </button>
            </div>
          )}
          <p className="text-sm text-gray-400 mb-6">
            Set up your agent details. Fields may be pre-populated from your token&apos;s agent URI.
          </p>

          <form onSubmit={handleERC8004Register} className="space-y-4">
            {renderFormFields(false)}

            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 rounded-md bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {loading ? "Signing..." : "Register Agent"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
