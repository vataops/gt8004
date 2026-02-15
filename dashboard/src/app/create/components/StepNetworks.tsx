import { NETWORK_LIST } from "@/lib/networks";

export interface StepNetworksProps {
  selectedNetworks: string[];
  onChange: (selectedNetworks: string[]) => void;
}

export function StepNetworks({ selectedNetworks, onChange }: StepNetworksProps) {
  const toggleNetwork = (key: string) => {
    if (selectedNetworks.includes(key)) {
      onChange(selectedNetworks.filter((k) => k !== key));
    } else {
      onChange([...selectedNetworks, key]);
    }
  };

  return (
    <div>
      <h2 className="text-lg font-semibold mb-1">Step 6: Select Networks</h2>
      <p className="text-sm text-zinc-400 mb-4">
        Choose which blockchain networks to register your agent on. Multi-network registration creates a unified identity across chains.
      </p>

      <div className="flex items-start gap-2 p-3 rounded-lg border border-[#1f1f1f] bg-[#0f0f0f] mb-5 text-sm text-zinc-400">
        <span className="text-zinc-500 mt-0.5">&#9432;</span>
        <span>Select multiple networks to create a cross-chain agent identity. The same metadata will be shared across all selected chains.</span>
      </div>

      <p className="text-sm font-medium text-gray-300 mb-1">Available Networks</p>
      <p className="text-xs text-zinc-500 mb-3">Select one or more networks where your agent will be registered</p>

      <div className="space-y-2">
        {NETWORK_LIST.map((net) => {
          const selected = selectedNetworks.includes(net.key);
          return (
            <button
              key={net.key}
              onClick={() => toggleNetwork(net.key)}
              className={`w-full text-left p-4 rounded-lg border transition-colors ${
                selected
                  ? "border-[#00FFE0]/30 bg-[#00FFE0]/10"
                  : "border-[#1f1f1f] bg-[#0f0f0f] hover:border-[#00FFE0]/50"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                  selected ? "border-[#00FFE0]/30 bg-[#00FFE0]" : "border-gray-600"
                }`}>
                  {selected && (
                    <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-200">{net.name}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-zinc-500">
                      Chain ID: <span className="font-mono text-zinc-400">{net.chainId}</span>
                    </span>
                    <span className="text-xs text-zinc-500">
                      Registry: <span className="font-mono text-zinc-400">{net.contractAddress.slice(0, 8)}...{net.contractAddress.slice(-6)}</span>
                    </span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function validateNetworks(selectedNetworks: string[]): string | null {
  if (selectedNetworks.length === 0) {
    return "Select at least one network";
  }
  return null;
}
