export interface StepAdvancedProps {
  active: boolean;
  x402Support: boolean;
  supportedTrust: string[];
  onChange: (partial: { active?: boolean; x402Support?: boolean; supportedTrust?: string[] }) => void;
}

const TRUST_MECHANISMS = [
  {
    key: "reputation",
    label: "Reputation-based Trust",
    description: "Validators provide subjective feedback on agent performance and behavior (thumbs up/down, star ratings, text reviews)",
  },
  {
    key: "crypto-economic",
    label: "Crypto-economic Trust",
    description: "Validators stake tokens to vouch for agent behavior; slashed if found malicious",
  },
  {
    key: "tee",
    label: "TEE Attestation Trust",
    description: "Trusted Execution Environment provides cryptographic proof of agent code and execution integrity",
  },
];

export function StepAdvanced({ active, x402Support, supportedTrust, onChange }: StepAdvancedProps) {
  const toggleTrust = (key: string) => {
    if (supportedTrust.includes(key)) {
      onChange({ supportedTrust: supportedTrust.filter((t) => t !== key) });
    } else {
      onChange({ supportedTrust: [...supportedTrust, key] });
    }
  };

  return (
    <div>
      <h2 className="text-lg font-semibold mb-1">Step 4: Advanced Options (Optional)</h2>
      <p className="text-sm text-zinc-400 mb-4">
        Configure trust mechanisms and payment support. All fields are optional and can be updated later.
      </p>

      <div className="flex items-start gap-2 p-3 rounded-lg border border-[#1f1f1f] bg-[#0f0f0f] mb-6 text-sm text-zinc-400">
        <span className="text-zinc-500 mt-0.5">&#9432;</span>
        <span>These options help users understand your agent&apos;s trust model and operational capabilities.</span>
      </div>

      {/* Trust Mechanisms */}
      <div className="mb-6">
        <p className="text-sm font-medium text-gray-300 mb-1">Supported Trust Mechanisms</p>
        <p className="text-xs text-zinc-500 mb-3">Select the trust mechanisms your agent supports for validation and reputation</p>
        <div className="space-y-2">
          {TRUST_MECHANISMS.map((tm) => (
            <label
              key={tm.key}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                supportedTrust.includes(tm.key)
                  ? "border-[#00FFE0]/30 bg-[#00FFE0]/10"
                  : "border-[#1f1f1f] bg-[#0f0f0f] hover:border-[#00FFE0]/50"
              }`}
            >
              <input
                type="checkbox"
                checked={supportedTrust.includes(tm.key)}
                onChange={() => toggleTrust(tm.key)}
                className="mt-1 accent-[#00FFE0]"
              />
              <div>
                <p className="text-sm font-medium text-gray-200">{tm.label}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{tm.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Divider */}
      <hr className="border-[#1a1a1a] mb-6" />

      {/* Agent Status */}
      <div className="mb-6">
        <p className="text-sm font-medium text-gray-300 mb-1">Agent Status (optional)</p>
        <p className="text-xs text-zinc-500 mb-3">Mark whether your agent is currently active and accepting requests</p>
        <label className="flex items-start gap-3 p-3 rounded-lg border border-[#1f1f1f] bg-[#0f0f0f] cursor-pointer hover:border-[#00FFE0]/50 transition-colors">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => onChange({ active: e.target.checked })}
            className="mt-1 accent-[#00FFE0]"
          />
          <div>
            <p className="text-sm font-medium text-gray-200">Agent is Active</p>
            <p className="text-xs text-zinc-500 mt-0.5">Check this if your agent is operational and ready to receive requests. Uncheck for maintenance or testing periods.</p>
          </div>
        </label>
      </div>

      {/* Divider */}
      <hr className="border-[#1a1a1a] mb-6" />

      {/* Payment Protocol */}
      <div>
        <p className="text-sm font-medium text-gray-300 mb-1">Payment Protocol Support</p>
        <p className="text-xs text-zinc-500 mb-3">Indicate support for the HTTP 402 Payment Required standard</p>
        <label className="flex items-start gap-3 p-3 rounded-lg border border-[#1f1f1f] bg-[#0f0f0f] cursor-pointer hover:border-[#00FFE0]/50 transition-colors">
          <input
            type="checkbox"
            checked={x402Support}
            onChange={(e) => onChange({ x402Support: e.target.checked })}
            className="mt-1 accent-[#00FFE0]"
          />
          <div>
            <p className="text-sm font-medium text-gray-200">HTTP 402 Payment Support (x402)</p>
            <p className="text-xs text-zinc-500 mt-0.5">Enable if your agent implements the HTTP 402 standard for paid services (microtransactions, per-request billing)</p>
          </div>
        </label>
      </div>
    </div>
  );
}
