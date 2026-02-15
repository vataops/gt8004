import { useState } from "react";

export interface ServiceEntry {
  type: "mcp" | "a2a" | "oasf" | "custom";
  endpoint: string;
  version: string;
  skills: string[];
  domains: string[];
  mcpTools: string[];
  mcpPrompts: string[];
  mcpResources: string[];
}

export function emptyService(type: ServiceEntry["type"] = "mcp"): ServiceEntry {
  return { type, endpoint: "", version: "", skills: [], domains: [], mcpTools: [], mcpPrompts: [], mcpResources: [] };
}

export interface StepServicesProps {
  services: ServiceEntry[];
  onChange: (services: ServiceEntry[]) => void;
}

const SERVICE_TYPES: { key: ServiceEntry["type"]; label: string; color: string; description: string }[] = [
  { key: "mcp", label: "MCP", color: "text-cyan-400 border-cyan-600 bg-cyan-900/20", description: "Model Context Protocol service for AI tools, prompts and resources" },
  { key: "a2a", label: "A2A", color: "text-emerald-400 border-emerald-600 bg-emerald-900/20", description: "Agent-to-Agent communication protocol" },
  { key: "oasf", label: "OASF", color: "text-[#00FFE0] border-[#00FFE0]/30 bg-[#00FFE0]/10", description: "Open Agentic Schema Framework service" },
  { key: "custom", label: "Custom", color: "text-zinc-400 border-zinc-600 bg-zinc-900/20", description: "Custom service type" },
];

export function StepServices({ services, onChange }: StepServicesProps) {
  const [activeTab, setActiveTab] = useState<ServiceEntry["type"]>("mcp");
  const [draft, setDraft] = useState<ServiceEntry>(emptyService("mcp"));
  const [toolsInput, setToolsInput] = useState("");
  const [promptsInput, setPromptsInput] = useState("");
  const [resourcesInput, setResourcesInput] = useState("");

  const activeType = SERVICE_TYPES.find((t) => t.key === activeTab)!;

  const handleAddService = () => {
    const svc: ServiceEntry = {
      ...draft,
      type: activeTab,
      mcpTools: activeTab === "mcp" ? toolsInput.split(",").map((s) => s.trim()).filter(Boolean) : [],
      mcpPrompts: activeTab === "mcp" ? promptsInput.split(",").map((s) => s.trim()).filter(Boolean) : [],
      mcpResources: activeTab === "mcp" ? resourcesInput.split(",").map((s) => s.trim()).filter(Boolean) : [],
    };
    onChange([...services, svc]);
    setDraft(emptyService(activeTab));
    setToolsInput("");
    setPromptsInput("");
    setResourcesInput("");
  };

  const handleRemoveService = (index: number) => {
    onChange(services.filter((_, i) => i !== index));
  };

  return (
    <div>
      <h2 className="text-lg font-semibold mb-1">Step 2: Communication Services</h2>
      <p className="text-sm text-zinc-400 mb-4">
        Optionally add services so others can communicate with your agent. Services define how users and other agents can reach your agent.
      </p>

      {/* Info banner */}
      <div className="flex items-start gap-2 p-3 rounded-lg border border-[#1f1f1f] bg-[#0f0f0f] mb-5 text-sm text-zinc-400">
        <span className="text-zinc-500 mt-0.5">&#9432;</span>
        <span>Services are optional. You can add them now or skip this step and add them later.</span>
      </div>

      {/* Added services list */}
      {services.length > 0 && (
        <div className="mb-5 space-y-2">
          <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Added Services ({services.length})</p>
          {services.map((svc, i) => {
            const typeInfo = SERVICE_TYPES.find((t) => t.key === svc.type)!;
            return (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-[#1f1f1f] bg-[#0f0f0f]">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${typeInfo.color}`}>
                      {typeInfo.label}
                    </span>
                    <span className="text-sm text-gray-300 truncate">{svc.endpoint || "(no endpoint)"}</span>
                  </div>
                  {svc.mcpTools.length > 0 && (
                    <p className="text-xs text-zinc-500">Tools: {svc.mcpTools.join(", ")}</p>
                  )}
                </div>
                <button
                  onClick={() => handleRemoveService(i)}
                  className="ml-2 text-gray-600 hover:text-red-400 transition-colors text-lg"
                  title="Remove service"
                >
                  &times;
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add New Service */}
      <p className="text-sm font-medium text-gray-300 mb-2">Add New Service</p>

      {/* Tab selector */}
      <div className="flex mb-4 rounded-lg border border-[#1f1f1f] overflow-hidden">
        {SERVICE_TYPES.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setActiveTab(t.key);
              setDraft(emptyService(t.key));
              setToolsInput("");
              setPromptsInput("");
              setResourcesInput("");
            }}
            className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === t.key
                ? "bg-[#00FFE0]/10 text-[#00FFE0]"
                : "bg-[#0f0f0f] text-zinc-500 hover:text-gray-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Type description */}
      <div className="flex items-start gap-2 p-3 rounded-lg border border-[#1f1f1f] bg-[#0f0f0f] mb-4 text-sm text-zinc-400">
        <span className="text-zinc-500 mt-0.5">&#9432;</span>
        <span>{activeType.description}</span>
      </div>

      {/* Service URL */}
      <div className="mb-3">
        <label className="block text-xs text-zinc-500 mb-1">Service URL</label>
        <input
          type="text"
          value={draft.endpoint}
          onChange={(e) => setDraft({ ...draft, endpoint: e.target.value })}
          placeholder={`https://api.example.com/${activeTab}`}
          className="w-full px-3 py-2 bg-[#141414] border border-[#1f1f1f] rounded-md text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#00FFE0]/50"
        />
      </div>

      {/* MCP-specific fields */}
      {activeTab === "mcp" && (
        <>
          <div className="mb-3">
            <label className="block text-xs text-zinc-500 mb-1">Tools (comma-separated, optional)</label>
            <input
              type="text"
              value={toolsInput}
              onChange={(e) => setToolsInput(e.target.value)}
              placeholder="data_analysis, chart_generation, report_builder"
              className="w-full px-3 py-2 bg-[#141414] border border-[#1f1f1f] rounded-md text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#00FFE0]/50"
            />
          </div>
          <div className="mb-3">
            <label className="block text-xs text-zinc-500 mb-1">Prompts (comma-separated, optional)</label>
            <input
              type="text"
              value={promptsInput}
              onChange={(e) => setPromptsInput(e.target.value)}
              placeholder="analyze_data, generate_report"
              className="w-full px-3 py-2 bg-[#141414] border border-[#1f1f1f] rounded-md text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#00FFE0]/50"
            />
          </div>
          <div className="mb-3">
            <label className="block text-xs text-zinc-500 mb-1">Resources (comma-separated, optional)</label>
            <input
              type="text"
              value={resourcesInput}
              onChange={(e) => setResourcesInput(e.target.value)}
              placeholder="database_schema, api_docs"
              className="w-full px-3 py-2 bg-[#141414] border border-[#1f1f1f] rounded-md text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#00FFE0]/50"
            />
          </div>
        </>
      )}

      {/* Add button */}
      <button
        onClick={handleAddService}
        disabled={!draft.endpoint.trim()}
        className="w-full py-2.5 rounded-md border border-[#1f1f1f] text-sm text-gray-300 hover:bg-[#141414] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        + Save &amp; Add Another {activeType.label} Service
      </button>
    </div>
  );
}
