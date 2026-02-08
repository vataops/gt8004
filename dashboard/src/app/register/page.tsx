"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { openApi } from "@/lib/api";
import type { RegisterRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { hasWallet, connectWallet, signChallenge } from "@/lib/wallet";
import { CopyButton } from "@/components/CopyButton";

const CATEGORIES = ["compute", "data", "inference", "storage", "other"];
const PROTOCOLS = ["a2a", "mcp", "x402", "custom"];

type Phase = "form" | "apikey" | "verify";

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [phase, setPhase] = useState<Phase>("form");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Form state
  const [agentId, setAgentId] = useState("");
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

  // Verify state
  const [verifyStatus, setVerifyStatus] = useState("");
  const [evmAddress, setEvmAddress] = useState("");

  const toggleProtocol = (p: string) => {
    setProtocols((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const req: RegisterRequest = {
        agent_id: agentId,
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
      setRegisteredAgentId(res.agent.agent_id);
      setPhase("apikey");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = async () => {
    try {
      await login(apiKey);
      router.push("/settings");
    } catch {
      router.push("/login");
    }
  };

  const handleVerify = async () => {
    setError("");
    setVerifyStatus("Connecting wallet...");

    try {
      const addr = await connectWallet();
      setEvmAddress(addr);
      setVerifyStatus("Requesting challenge...");

      const { challenge } = await openApi.getChallenge(registeredAgentId);
      setVerifyStatus("Sign the message in your wallet...");

      const signature = await signChallenge(challenge);
      setVerifyStatus("Verifying...");

      await openApi.verifySignature(registeredAgentId, challenge, signature);
      setVerifyStatus("verified");

      // Auto-login and redirect
      await login(apiKey);
      router.push("/settings");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
      setVerifyStatus("");
    }
  };

  // Phase 1: Registration Form
  if (phase === "form") {
    return (
      <div className="max-w-lg mx-auto">
        <h2 className="text-xl font-bold mb-6">Register Agent</h2>
        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Agent ID *</label>
            <input
              type="text"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              required
              placeholder="my-agent"
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
            />
          </div>

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
      </div>
    );
  }

  // Phase 2: API Key Display
  if (phase === "apikey") {
    return (
      <div className="max-w-lg mx-auto">
        <h2 className="text-xl font-bold mb-2">Agent Registered!</h2>
        <p className="text-sm text-gray-400 mb-6">
          Your agent <span className="text-white font-medium">{registeredAgentId}</span> has been registered.
        </p>

        <div className="p-4 rounded-lg border border-yellow-800 bg-yellow-900/20 mb-6">
          <p className="text-xs font-semibold text-yellow-400 mb-2">
            Save your API key now — it will only be shown once!
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm font-mono text-white bg-gray-900 px-3 py-2 rounded border border-gray-700 break-all">
              {apiKey}
            </code>
            <CopyButton text={apiKey} />
          </div>
        </div>

        <div className="space-y-3">
          {hasWallet() && (
            <button
              onClick={() => setPhase("verify")}
              className="w-full py-2 rounded-md bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors"
            >
              Verify Identity (ERC-8004)
            </button>
          )}
          <button
            onClick={handleContinue}
            className="w-full py-2 rounded-md bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium transition-colors"
          >
            Continue to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Phase 3: ERC-8004 Verification
  return (
    <div className="max-w-lg mx-auto">
      <h2 className="text-xl font-bold mb-2">Verify Identity</h2>
      <p className="text-sm text-gray-400 mb-6">
        Link your Ethereum wallet to your agent via ERC-8004 identity verification.
      </p>

      {verifyStatus === "verified" ? (
        <div className="p-4 rounded-lg border border-green-800 bg-green-900/20 mb-6">
          <p className="text-sm text-green-400 font-medium">Identity Verified!</p>
          <p className="text-xs text-gray-400 mt-1 font-mono">{evmAddress}</p>
        </div>
      ) : verifyStatus ? (
        <div className="p-4 rounded-lg border border-gray-700 bg-gray-900 mb-6">
          <p className="text-sm text-gray-300">{verifyStatus}</p>
        </div>
      ) : (
        <button
          onClick={handleVerify}
          className="w-full py-2 rounded-md bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium mb-4 transition-colors"
        >
          Connect Wallet & Sign
        </button>
      )}

      {error && (
        <p className="text-sm text-red-400 mb-4">{error}</p>
      )}

      <button
        onClick={handleContinue}
        className="w-full py-2 rounded-md bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium transition-colors"
      >
        {verifyStatus === "verified" ? "Continue to Settings" : "Skip"}
      </button>
    </div>
  );
}
