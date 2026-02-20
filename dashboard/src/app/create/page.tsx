"use client";

import { useState } from "react";
import { connectWallet } from "@/lib/wallet";
import { encodeDataUri, registerNewAgent } from "@/lib/erc8004";
import { NETWORKS } from "@/lib/networks";
import { openApi } from "@/lib/api";

import { StepBasicInfo, validateBasicInfo } from "./components/StepBasicInfo";
import { StepServices, type ServiceEntry, emptyService } from "./components/StepServices";
import { StepCapabilities } from "./components/StepCapabilities";
import { StepAdvanced } from "./components/StepAdvanced";
import { StepUri, buildMetadata, validateUri } from "./components/StepUri";
import { StepNetworks, validateNetworks } from "./components/StepNetworks";
import { StepReview } from "./components/StepReview";

interface WizardState {
  name: string;
  description: string;
  image: string;
  services: ServiceEntry[];
  oasfSkills: string[];
  oasfDomains: string[];
  active: boolean;
  x402Support: boolean;
  supportedTrust: string[];
  uriMode: "data" | "ipfs";
  ipfsUrl: string;
  selectedNetworks: string[];
}

const defaultState: WizardState = {
  name: "",
  description: "",
  image: "",
  services: [],
  oasfSkills: [],
  oasfDomains: [],
  active: false,
  x402Support: false,
  supportedTrust: [],
  uriMode: "data",
  ipfsUrl: "",
  selectedNetworks: [],
};

interface MintResult {
  networkKey: string;
  tokenId: number;
  txHash: string;
}

const STEPS = [
  { label: "Basic Info" },
  { label: "Services" },
  { label: "Capabilities" },
  { label: "Advanced" },
  { label: "URI" },
  { label: "Networks" },
  { label: "Review" },
];

export default function CreateAgentPage() {
  const [state, setState] = useState<WizardState>(defaultState);
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mintResults, setMintResults] = useState<MintResult[]>([]);
  const [mintingNetwork, setMintingNetwork] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const update = (partial: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  };

  // Validation per step
  const validateStep = (s: number): string | null => {
    switch (s) {
      case 1:
        return validateBasicInfo(state.name, state.description);
      case 5:
        return validateUri(state.uriMode, state.ipfsUrl);
      case 6:
        return validateNetworks(state.selectedNetworks);
      default:
        return null;
    }
  };

  const handleNext = () => {
    const err = validateStep(step);
    if (err) {
      setError(err);
      return;
    }
    setError("");
    setStep((s) => Math.min(s + 1, 7));
  };

  const handleBack = () => {
    setError("");
    setStep((s) => Math.max(s - 1, 1));
  };

  const handleGoToStep = (s: number) => {
    setError("");
    setStep(s);
  };

  // Connect wallet
  const handleConnectWallet = async () => {
    setError("");
    try {
      const addr = await connectWallet();
      setWalletAddress(addr);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect wallet");
    }
  };

  // Submit: mint on each selected network
  const handleSubmit = async () => {
    if (!walletAddress) {
      setError("Please connect your wallet first");
      return;
    }

    // Build the agentURI
    const metadata = buildMetadata(state);
    let agentUri: string;
    if (state.uriMode === "ipfs") {
      agentUri = state.ipfsUrl;
    } else {
      agentUri = encodeDataUri(metadata);
    }

    setSubmitting(true);
    setError("");
    const results: MintResult[] = [];

    for (const networkKey of state.selectedNetworks) {
      const net = NETWORKS[networkKey];
      if (!net) continue;

      setMintingNetwork(networkKey);
      try {
        const { tokenId, txHash } = await registerNewAgent(net.chainId, agentUri);
        results.push({ networkKey, tokenId, txHash });
        setMintResults([...results]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Transaction failed";
        setError(`Failed on ${net.name}: ${msg}`);
        setSubmitting(false);
        setMintingNetwork(null);
        return;
      }
    }

    setMintingNetwork(null);
    setSubmitting(false);
    setMintResults(results);
    setDone(true);

    // Trigger discovery sync for each minted token (fire-and-forget)
    for (const r of results) {
      const net = NETWORKS[r.networkKey];
      if (net) openApi.notifyMint(net.chainId, r.tokenId).catch(() => {});
    }
  };

  // Success view
  if (done && mintResults.length > 0) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-900/30 border border-green-800 flex items-center justify-center">
            <svg className="w-8 h-8 text-green-400" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-2">Agent Created Successfully!</h2>
          <p className="text-sm text-zinc-400">
            Your agent <span className="text-white font-medium">{state.name}</span> has been registered on-chain.
          </p>
        </div>

        <div className="space-y-3 mb-8">
          {mintResults.map((r) => {
            const net = NETWORKS[r.networkKey];
            return (
              <div key={r.networkKey} className="p-4 rounded-lg border border-[#1a1a1a] bg-[#0f0f0f]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-200">{net?.name}</span>
                  <span className="px-2 py-0.5 rounded text-xs bg-green-900/20 border border-green-800 text-green-400">Minted</span>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-zinc-500">
                    Token ID: <span className="font-mono text-gray-300">{r.tokenId}</span>
                  </p>
                  <p className="text-xs text-zinc-500">
                    Tx: <a
                      href={`${net?.blockExplorer}/tx/${r.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[#00FFE0] hover:text-[#00FFE0]/80"
                    >
                      {r.txHash.slice(0, 10)}...{r.txHash.slice(-8)}
                    </a>
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="space-y-2">
          {mintResults.map((r) => {
            const net = NETWORKS[r.networkKey];
            const agentUri = state.uriMode === "ipfs" ? state.ipfsUrl : encodeDataUri(buildMetadata(state));
            return (
              <a
                key={r.networkKey}
                href={`/register?token_id=${r.tokenId}&chain_id=${net?.chainId}&agent_uri=${encodeURIComponent(agentUri)}`}
                className="block w-full py-3 rounded-md bg-[#00FFE0] text-black hover:shadow-[0_0_20px_rgba(0,255,224,0.4)] text-sm font-medium text-center transition-all"
              >
                Register on GT8004 ({net?.name} #{r.tokenId})
              </a>
            );
          })}
          <a
            href="/"
            className="block w-full py-3 rounded-md border border-[#1f1f1f] text-gray-300 text-sm font-medium text-center hover:bg-[#141414] transition-colors"
          >
            Back to Explorer
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#141414] border border-[#1f1f1f] flex items-center justify-center">
          <svg className="w-6 h-6 text-[#00FFE0]" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        </div>
        <h1 className="text-xl font-bold">Mint Agent</h1>
        <p className="text-sm text-zinc-400">Mint your autonomous agent on the ERC-8004 registry</p>
      </div>

      {/* Step Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((s, i) => {
            const stepNum = i + 1;
            const isCompleted = step > stepNum;
            const isCurrent = step === stepNum;
            return (
              <div key={i} className="flex flex-col items-center flex-1">
                <div className="flex items-center w-full">
                  {i > 0 && (
                    <div className={`flex-1 h-0.5 ${isCompleted || isCurrent ? "bg-[#00FFE0]" : "bg-gray-700"}`} />
                  )}
                  <button
                    onClick={() => {
                      if (isCompleted) handleGoToStep(stepNum);
                    }}
                    disabled={!isCompleted}
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 transition-colors ${
                      isCompleted
                        ? "bg-[#00FFE0] text-black cursor-pointer hover:shadow-[0_0_20px_rgba(0,255,224,0.4)]"
                        : isCurrent
                          ? "bg-[#00FFE0]/10 border-2 border-[#00FFE0]/30 text-[#00FFE0]"
                          : "bg-[#141414] border border-[#1f1f1f] text-zinc-500"
                    }`}
                  >
                    {isCompleted ? (
                      <svg className="w-3.5 h-3.5" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      stepNum
                    )}
                  </button>
                  {i < STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 ${isCompleted ? "bg-[#00FFE0]" : "bg-gray-700"}`} />
                  )}
                </div>
                <span className={`mt-1.5 text-[10px] ${isCurrent ? "text-gray-300" : "text-gray-600"}`}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <div className="rounded-lg border border-[#1a1a1a] bg-[#0f0f0f] p-6 mb-4">
        {step === 1 && (
          <StepBasicInfo
            name={state.name}
            description={state.description}
            image={state.image}
            onChange={update}
          />
        )}
        {step === 2 && (
          <StepServices
            services={state.services}
            onChange={(services) => update({ services })}
          />
        )}
        {step === 3 && (
          <StepCapabilities
            oasfSkills={state.oasfSkills}
            oasfDomains={state.oasfDomains}
            onChange={update}
          />
        )}
        {step === 4 && (
          <StepAdvanced
            active={state.active}
            x402Support={state.x402Support}
            supportedTrust={state.supportedTrust}
            onChange={update}
          />
        )}
        {step === 5 && (
          <StepUri
            name={state.name}
            description={state.description}
            image={state.image}
            services={state.services}
            oasfSkills={state.oasfSkills}
            oasfDomains={state.oasfDomains}
            active={state.active}
            x402Support={state.x402Support}
            supportedTrust={state.supportedTrust}
            uriMode={state.uriMode}
            ipfsUrl={state.ipfsUrl}
            onChange={update}
          />
        )}
        {step === 6 && (
          <StepNetworks
            selectedNetworks={state.selectedNetworks}
            onChange={(selectedNetworks) => update({ selectedNetworks })}
          />
        )}
        {step === 7 && (
          <StepReview
            {...state}
            onGoToStep={handleGoToStep}
          />
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-400 mb-4">{error}</p>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        {step > 1 ? (
          <button
            onClick={handleBack}
            disabled={submitting}
            className="px-4 py-2.5 rounded-md border border-[#1f1f1f] text-sm text-gray-300 hover:bg-[#141414] transition-colors disabled:opacity-50"
          >
            &larr; Back
          </button>
        ) : (
          <div />
        )}

        {step < 7 ? (
          <button
            onClick={handleNext}
            className="px-6 py-2.5 rounded-md bg-[#00FFE0] text-black hover:shadow-[0_0_20px_rgba(0,255,224,0.4)] text-sm font-medium transition-shadow"
          >
            Next: {STEPS[step]?.label} &rarr;
          </button>
        ) : (
          <div className="flex items-center gap-3">
            {!walletAddress ? (
              <button
                onClick={handleConnectWallet}
                className="px-6 py-2.5 rounded-md bg-[#00FFE0] text-black hover:shadow-[0_0_20px_rgba(0,255,224,0.4)] text-sm font-medium transition-shadow"
              >
                Connect Wallet
              </button>
            ) : (
              <>
                <span className="text-xs text-zinc-500">
                  {walletAddress.slice(0, 6)}&hellip;{walletAddress.slice(-4)}
                </span>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-md bg-[#00FFE0] text-black hover:shadow-[0_0_20px_rgba(0,255,224,0.4)] text-sm font-medium transition-shadow disabled:opacity-50"
                >
                  {submitting
                    ? `Minting on ${NETWORKS[mintingNetwork || ""]?.name || "\u2026"}\u2026`
                    : "Register Agent"}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Minting progress */}
      {submitting && mintResults.length > 0 && (
        <div className="mt-4 space-y-2">
          {mintResults.map((r) => (
            <div key={r.networkKey} className="flex items-center gap-2 text-xs text-green-400">
              <svg className="w-3.5 h-3.5" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {NETWORKS[r.networkKey]?.name} - Agent #{r.tokenId}
            </div>
          ))}
          {mintingNetwork && (
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <div className="w-3.5 h-3.5 border-2 border-[#00FFE0] border-t-transparent rounded-full animate-spin" />
              Minting on {NETWORKS[mintingNetwork]?.name}\u2026
            </div>
          )}
        </div>
      )}
    </div>
  );
}
