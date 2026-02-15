import { NETWORKS } from "@/lib/networks";
import { resolveImageUrl } from "@/lib/networks";
import type { ServiceEntry } from "./StepServices";

export interface StepReviewProps {
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
  onGoToStep: (step: number) => void;
}

const SERVICE_COLORS: Record<string, string> = {
  mcp: "text-cyan-400 border-cyan-600 bg-cyan-900/20",
  a2a: "text-emerald-400 border-emerald-600 bg-emerald-900/20",
  oasf: "text-[#00FFE0] border-[#00FFE0]/30 bg-[#00FFE0]/10",
  custom: "text-zinc-400 border-zinc-600 bg-zinc-900/20",
};

function Section({ title, step, onEdit, children }: {
  title: string;
  step: number;
  onEdit: (step: number) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[#1f1f1f] bg-[#0f0f0f] p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-gray-200">{title}</p>
        <button
          onClick={() => onEdit(step)}
          className="text-xs text-[#00FFE0] hover:text-[#00FFE0]/70 transition-colors"
        >
          Edit
        </button>
      </div>
      {children}
    </div>
  );
}

export function StepReview(props: StepReviewProps) {
  const { onGoToStep } = props;
  const resolvedImage = resolveImageUrl(props.image);

  return (
    <div>
      <h2 className="text-lg font-semibold mb-1">Step 7: Review</h2>
      <p className="text-sm text-zinc-400 mb-5">
        Review your agent details before registering on-chain.
      </p>

      {/* Basic Info */}
      <Section title="Basic Information" step={1} onEdit={onGoToStep}>
        <div className="flex gap-4">
          {resolvedImage && (
            <div className="w-14 h-14 rounded-lg border border-[#1f1f1f] overflow-hidden bg-[#141414] flex-shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={resolvedImage} alt="" className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white mb-1">{props.name || "(unnamed)"}</p>
            <p className="text-xs text-zinc-400 line-clamp-3">{props.description || "(no description)"}</p>
          </div>
        </div>
      </Section>

      {/* Services */}
      <Section title="Communication Services" step={2} onEdit={onGoToStep}>
        {props.services.length > 0 ? (
          <div className="space-y-2">
            {props.services.map((svc, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-xs font-medium border ${SERVICE_COLORS[svc.type] || SERVICE_COLORS.custom}`}>
                  {svc.type.toUpperCase()}
                </span>
                <span className="text-xs text-zinc-400 truncate">{svc.endpoint || "(no endpoint)"}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-zinc-500 italic">No services added</p>
        )}
      </Section>

      {/* Capabilities */}
      <Section title="Capabilities" step={3} onEdit={onGoToStep}>
        {props.oasfSkills.length > 0 || props.oasfDomains.length > 0 ? (
          <div className="space-y-2">
            {props.oasfSkills.length > 0 && (
              <div>
                <p className="text-xs text-zinc-500 mb-1">Skills</p>
                <div className="flex flex-wrap gap-1">
                  {props.oasfSkills.map((s) => (
                    <span key={s} className="px-2 py-0.5 rounded text-xs bg-[#00FFE0]/10 border border-[#00FFE0]/30 text-[#00FFE0]">{s}</span>
                  ))}
                </div>
              </div>
            )}
            {props.oasfDomains.length > 0 && (
              <div>
                <p className="text-xs text-zinc-500 mb-1">Domains</p>
                <div className="flex flex-wrap gap-1">
                  {props.oasfDomains.map((d) => (
                    <span key={d} className="px-2 py-0.5 rounded text-xs bg-[#00FFE0]/10 border border-[#00FFE0]/30 text-[#00FFE0]">{d}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-zinc-500 italic">No capabilities selected</p>
        )}
      </Section>

      {/* Advanced */}
      <Section title="Advanced Options" step={4} onEdit={onGoToStep}>
        <div className="flex flex-wrap gap-2">
          {props.active && (
            <span className="px-2 py-0.5 rounded text-xs bg-green-900/20 border border-green-800 text-green-400">Active</span>
          )}
          {props.x402Support && (
            <span className="px-2 py-0.5 rounded text-xs bg-[#00FFE0]/10 border border-[#00FFE0]/30 text-[#00FFE0]">x402 Payment</span>
          )}
          {props.supportedTrust.map((t) => (
            <span key={t} className="px-2 py-0.5 rounded text-xs bg-[#141414] border border-[#1f1f1f] text-zinc-400 capitalize">{t}</span>
          ))}
          {!props.active && !props.x402Support && props.supportedTrust.length === 0 && (
            <p className="text-xs text-zinc-500 italic">No advanced options configured</p>
          )}
        </div>
      </Section>

      {/* URI */}
      <Section title="Metadata Storage" step={5} onEdit={onGoToStep}>
        <p className="text-xs text-zinc-400">
          {props.uriMode === "data"
            ? "Auto (Data URI) - Base64-encoded on-chain storage"
            : `IPFS - ${props.ipfsUrl || "(no URL provided)"}`}
        </p>
      </Section>

      {/* Networks */}
      <Section title="Networks" step={6} onEdit={onGoToStep}>
        <div className="flex flex-wrap gap-2">
          {props.selectedNetworks.map((key) => {
            const net = NETWORKS[key];
            return net ? (
              <span key={key} className="px-2 py-0.5 rounded text-xs bg-[#00FFE0]/10 border border-[#00FFE0]/30 text-[#00FFE0]">
                {net.name}
              </span>
            ) : null;
          })}
          {props.selectedNetworks.length === 0 && (
            <p className="text-xs text-zinc-500 italic">No networks selected</p>
          )}
        </div>
      </Section>
    </div>
  );
}
