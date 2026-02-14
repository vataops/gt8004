import { useMemo } from "react";
import type { ServiceEntry } from "./StepServices";
import { encodeDataUri } from "@/lib/erc8004";

export interface StepUriProps {
  // All wizard state needed to build metadata
  name: string;
  description: string;
  image: string;
  services: ServiceEntry[];
  oasfSkills: string[];
  oasfDomains: string[];
  active: boolean;
  x402Support: boolean;
  supportedTrust: string[];
  // URI-specific state
  uriMode: "data" | "ipfs";
  ipfsUrl: string;
  onChange: (partial: { uriMode?: "data" | "ipfs"; ipfsUrl?: string }) => void;
}

export function buildMetadata(props: Omit<StepUriProps, "uriMode" | "ipfsUrl" | "onChange">): Record<string, unknown> {
  const meta: Record<string, unknown> = {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name: props.name,
    description: props.description,
  };

  if (props.image) meta.image = props.image;

  const services: Record<string, unknown>[] = props.services.map((svc) => {
    const entry: Record<string, unknown> = { name: svc.type, endpoint: svc.endpoint };
    if (svc.version) entry.version = svc.version;
    if (svc.mcpTools.length > 0) entry.mcpTools = svc.mcpTools;
    if (svc.mcpPrompts.length > 0) entry.mcpPrompts = svc.mcpPrompts;
    if (svc.mcpResources.length > 0) entry.mcpResources = svc.mcpResources;
    if (svc.skills.length > 0) entry.skills = svc.skills;
    if (svc.domains.length > 0) entry.domains = svc.domains;
    return entry;
  });

  // Merge OASF skills/domains into an OASF service entry if present, or add standalone
  if (props.oasfSkills.length > 0 || props.oasfDomains.length > 0) {
    const oasfSvc = services.find((s) => s.name === "oasf");
    if (oasfSvc) {
      if (props.oasfSkills.length > 0) oasfSvc.skills = props.oasfSkills;
      if (props.oasfDomains.length > 0) oasfSvc.domains = props.oasfDomains;
    } else {
      const entry: Record<string, unknown> = { name: "oasf" };
      if (props.oasfSkills.length > 0) entry.skills = props.oasfSkills;
      if (props.oasfDomains.length > 0) entry.domains = props.oasfDomains;
      services.push(entry);
    }
  }

  meta.services = services;
  if (props.active) meta.active = true;
  if (props.x402Support) meta.x402Support = true;
  if (props.supportedTrust.length > 0) meta.supportedTrust = props.supportedTrust;

  return meta;
}

export function StepUri(props: StepUriProps) {
  const { uriMode, ipfsUrl, onChange } = props;

  const metadata = useMemo(() => buildMetadata(props), [
    props.name, props.description, props.image,
    props.services, props.oasfSkills, props.oasfDomains,
    props.active, props.x402Support, props.supportedTrust,
  ]);

  const jsonString = useMemo(() => JSON.stringify(metadata, null, 2), [metadata]);
  const dataUri = useMemo(() => encodeDataUri(metadata), [metadata]);
  const metadataSize = new Blob([JSON.stringify(metadata)]).size;

  const handleDownloadJson = () => {
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${props.name.replace(/\s+/g, "-").toLowerCase() || "agent"}-metadata.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <h2 className="text-lg font-semibold mb-1">Step 5: Metadata Storage</h2>
      <p className="text-sm text-gray-400 mb-4">Choose how to store your agent metadata</p>

      {/* Download button */}
      <div className="flex items-center justify-between p-3 rounded-lg border border-gray-700 bg-gray-900/50 mb-5">
        <div>
          <p className="text-sm font-medium text-gray-200">Download Metadata</p>
          <p className="text-xs text-gray-500">Download your agent metadata as a JSON file for backup or self-hosting</p>
        </div>
        <button
          onClick={handleDownloadJson}
          className="px-3 py-1.5 rounded-md bg-gray-800 border border-gray-700 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
        >
          Download JSON
        </button>
      </div>

      {/* Mode toggle */}
      <div className="flex mb-4 rounded-lg border border-gray-700 overflow-hidden">
        <button
          onClick={() => onChange({ uriMode: "data" })}
          className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
            uriMode === "data" ? "bg-gray-800 text-white" : "bg-gray-900 text-gray-500 hover:text-gray-300"
          }`}
        >
          Auto (Data URI)
        </button>
        <button
          onClick={() => onChange({ uriMode: "ipfs" })}
          className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
            uriMode === "ipfs" ? "bg-gray-800 text-white" : "bg-gray-900 text-gray-500 hover:text-gray-300"
          }`}
        >
          IPFS URL
        </button>
      </div>

      {uriMode === "data" ? (
        <>
          <div className="flex items-start gap-2 p-3 rounded-lg border border-gray-700 bg-gray-900/50 mb-4 text-sm text-gray-400">
            <span className="text-gray-500 mt-0.5">&#9432;</span>
            <span>
              We&apos;ll automatically convert your metadata to a base64-encoded data URI and store it directly
              on-chain. This is the simplest option and requires no external hosting.
            </span>
          </div>

          {/* Size */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-gray-700 bg-gray-900/50 mb-4">
            <span className="text-sm text-gray-300">Metadata Size</span>
            <span className="text-sm font-mono text-gray-400">{metadataSize.toLocaleString()} B</span>
          </div>

          {metadataSize > 10000 && (
            <div className="flex items-start gap-2 p-3 rounded-lg border border-yellow-800 bg-yellow-900/10 mb-4 text-sm text-yellow-400">
              <span className="mt-0.5">&#9888;</span>
              <span>Large metadata (&gt;10KB) may result in high gas costs. Consider using IPFS for large payloads.</span>
            </div>
          )}

          {/* Preview */}
          <div className="rounded-lg border border-gray-700 bg-gray-950 p-3 mb-3">
            <p className="text-xs font-semibold text-gray-400 mb-2">Preview:</p>
            <p className="text-xs font-mono text-gray-500 break-all">
              {dataUri.length > 200 ? dataUri.slice(0, 200) + " ..." : dataUri}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="px-2 py-0.5 rounded text-xs bg-green-900/20 border border-green-800 text-green-400">Recommended</span>
            <span className="px-2 py-0.5 rounded text-xs bg-gray-800 border border-gray-700 text-gray-400">On-chain storage</span>
            <span className="px-2 py-0.5 rounded text-xs bg-gray-800 border border-gray-700 text-gray-400">No external dependencies</span>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-start gap-2 p-3 rounded-lg border border-gray-700 bg-gray-900/50 mb-4 text-sm text-gray-400">
            <span className="text-gray-500 mt-0.5">&#9432;</span>
            <span>
              Upload your metadata JSON to IPFS and provide the URL. The on-chain token will store
              this IPFS URL instead of the raw data.
            </span>
          </div>

          <div className="mb-3">
            <label className="block text-xs text-gray-500 mb-1">IPFS URL</label>
            <input
              type="text"
              value={ipfsUrl}
              onChange={(e) => onChange({ ipfsUrl: e.target.value })}
              placeholder="ipfs://QmYourHash... or https://ipfs.io/ipfs/..."
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
            />
          </div>
        </>
      )}

      {/* JSON preview (always shown) */}
      <details className="mt-5">
        <summary className="text-sm text-gray-400 cursor-pointer hover:text-gray-300">
          View raw metadata JSON
        </summary>
        <pre className="mt-2 p-3 rounded-lg border border-gray-700 bg-gray-950 text-xs font-mono text-gray-400 overflow-x-auto max-h-64 overflow-y-auto">
          {jsonString}
        </pre>
      </details>
    </div>
  );
}

export function validateUri(uriMode: "data" | "ipfs", ipfsUrl: string): string | null {
  if (uriMode === "ipfs" && !ipfsUrl.trim()) {
    return "IPFS URL is required when using IPFS mode";
  }
  return null;
}
