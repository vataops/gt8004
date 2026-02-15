import { resolveImageUrl } from "@/lib/networks";

export interface StepBasicInfoProps {
  name: string;
  description: string;
  image: string;
  onChange: (partial: { name?: string; description?: string; image?: string }) => void;
}

export function StepBasicInfo({ name, description, image, onChange }: StepBasicInfoProps) {
  const resolvedImage = resolveImageUrl(image);

  return (
    <div>
      <h2 className="text-lg font-semibold mb-1">Step 1: Basic Information</h2>
      <p className="text-sm text-zinc-400 mb-6">
        The name, image, and description are your gateway to the world! They will be displayed
        across all ERC-721 compatible applications, explorers, and marketplaces.
      </p>

      {/* Agent Name */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          Agent Name <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => onChange({ name: e.target.value })}
          maxLength={100}
          placeholder="DataAnalyst Pro"
          className="w-full px-3 py-2 bg-[#141414] border border-[#1f1f1f] rounded-md text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#00FFE0]/50"
        />
        <p className="mt-1 text-xs text-zinc-500">
          {name.length}/100 - Keep it clear, memorable, and descriptive
        </p>
      </div>

      {/* Description */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          Description <span className="text-red-400">*</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => onChange({ description: e.target.value })}
          maxLength={2000}
          rows={5}
          placeholder="A specialized AI agent that performs advanced data analysis, chart generation, and automated reporting. Ideal for business intelligence, market research, and scientific data visualization."
          className="w-full px-3 py-2 bg-[#141414] border border-[#1f1f1f] rounded-md text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#00FFE0]/50 resize-y"
        />
        <p className={`mt-1 text-xs ${description.length > 0 && description.length < 50 ? "text-red-400" : "text-zinc-500"}`}>
          {description.length}/2000 - Explain what your agent does, how it works, what problems it solves
          {description.length > 0 && description.length < 50 && (
            <span className="text-red-400"> (minimum 50 characters required)</span>
          )}
        </p>
      </div>

      {/* Agent Image */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          Agent Image <span className="text-zinc-500">(optional)</span>
        </label>
        {resolvedImage && (
          <div className="mb-3 w-20 h-20 rounded-lg border border-[#1f1f1f] overflow-hidden bg-[#141414]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resolvedImage}
              alt="Agent preview"
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </div>
        )}
        <input
          type="text"
          value={image}
          onChange={(e) => onChange({ image: e.target.value })}
          placeholder="https://cdn.example.com/agent.png or ipfs://..."
          className="w-full px-3 py-2 bg-[#141414] border border-[#1f1f1f] rounded-md text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#00FFE0]/50"
        />
        <p className="mt-1 text-xs text-zinc-500">
          High-quality image (PNG, SVG, or WebP recommended). Supports HTTP, HTTPS, or IPFS URLs.
        </p>
      </div>
    </div>
  );
}

export function validateBasicInfo(name: string, description: string): string | null {
  if (!name.trim()) return "Agent name is required";
  if (!description.trim()) return "Description is required";
  if (description.trim().length < 50) return "Description must be at least 50 characters";
  return null;
}
