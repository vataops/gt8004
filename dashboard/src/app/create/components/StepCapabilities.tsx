import { useState } from "react";
import { OASF_SKILL_CATEGORIES, OASF_DOMAINS } from "@/lib/oasf-taxonomy";

export interface StepCapabilitiesProps {
  oasfSkills: string[];
  oasfDomains: string[];
  onChange: (partial: { oasfSkills?: string[]; oasfDomains?: string[] }) => void;
}

export function StepCapabilities({ oasfSkills, oasfDomains, onChange }: StepCapabilitiesProps) {
  const [skillSearch, setSkillSearch] = useState("");
  const [domainSearch, setDomainSearch] = useState("");

  const toggleSkill = (skill: string) => {
    if (oasfSkills.includes(skill)) {
      onChange({ oasfSkills: oasfSkills.filter((s) => s !== skill) });
    } else {
      onChange({ oasfSkills: [...oasfSkills, skill] });
    }
  };

  const toggleDomain = (domain: string) => {
    if (oasfDomains.includes(domain)) {
      onChange({ oasfDomains: oasfDomains.filter((d) => d !== domain) });
    } else {
      onChange({ oasfDomains: [...oasfDomains, domain] });
    }
  };

  const filteredCategories = OASF_SKILL_CATEGORIES.map((cat) => ({
    ...cat,
    skills: cat.skills.filter((s) => s.toLowerCase().includes(skillSearch.toLowerCase())),
  })).filter((cat) => cat.skills.length > 0);

  const filteredDomains = OASF_DOMAINS.filter((d) =>
    d.toLowerCase().includes(domainSearch.toLowerCase())
  );

  return (
    <div>
      <h2 className="text-lg font-semibold mb-1">Step 3: Capabilities (Optional)</h2>
      <p className="text-sm text-gray-400 mb-4">
        Add OASF (Open Agentic Schema Framework) skills and domains to help users discover your agent
      </p>

      <div className="flex items-start gap-2 p-3 rounded-lg border border-gray-700 bg-gray-900/50 mb-5 text-sm text-gray-400">
        <span className="text-gray-500 mt-0.5">&#9432;</span>
        <span>OASF provides a standardized taxonomy for agent capabilities.</span>
      </div>

      {/* OASF Skills */}
      <div className="mb-6">
        <p className="text-sm font-medium text-gray-300 mb-1">OASF Skills (optional)</p>
        <p className="text-xs text-gray-500 mb-2">Select official OASF skills from the taxonomy</p>

        {/* Selected skills tags */}
        {oasfSkills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {oasfSkills.map((skill) => (
              <span
                key={skill}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-purple-900/30 border border-purple-700 text-xs text-purple-300"
              >
                {skill}
                <button onClick={() => toggleSkill(skill)} className="text-purple-400 hover:text-purple-200">&times;</button>
              </span>
            ))}
          </div>
        )}

        {/* Search */}
        <input
          type="text"
          value={skillSearch}
          onChange={(e) => setSkillSearch(e.target.value)}
          placeholder="Search skills..."
          className="w-full px-3 py-2 mb-3 bg-gray-900 border border-gray-700 rounded-md text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
        />

        {/* Skill categories */}
        <div className="max-h-56 overflow-y-auto rounded-lg border border-gray-700 bg-gray-900/50">
          {filteredCategories.map((cat) => (
            <div key={cat.category}>
              <p className="px-3 pt-2 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-wider sticky top-0 bg-gray-900">
                {cat.category}
              </p>
              <div className="px-2 pb-1 flex flex-wrap gap-1">
                {cat.skills.map((skill) => {
                  const selected = oasfSkills.includes(skill);
                  return (
                    <button
                      key={skill}
                      onClick={() => toggleSkill(skill)}
                      className={`px-2 py-1 rounded text-xs transition-colors ${
                        selected
                          ? "bg-purple-600/30 border border-purple-500 text-purple-300"
                          : "bg-gray-800 border border-gray-700 text-gray-400 hover:border-gray-500"
                      }`}
                    >
                      {skill}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {filteredCategories.length === 0 && (
            <p className="px-3 py-4 text-xs text-gray-500 text-center">No skills match your search</p>
          )}
        </div>
      </div>

      {/* OASF Domains */}
      <div>
        <p className="text-sm font-medium text-gray-300 mb-1">OASF Domains (optional)</p>
        <p className="text-xs text-gray-500 mb-2">Select official OASF domains from the taxonomy</p>

        {/* Selected domain tags */}
        {oasfDomains.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {oasfDomains.map((domain) => (
              <span
                key={domain}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-purple-900/30 border border-purple-700 text-xs text-purple-300"
              >
                {domain}
                <button onClick={() => toggleDomain(domain)} className="text-purple-400 hover:text-purple-200">&times;</button>
              </span>
            ))}
          </div>
        )}

        {/* Search */}
        <input
          type="text"
          value={domainSearch}
          onChange={(e) => setDomainSearch(e.target.value)}
          placeholder="Search domains..."
          className="w-full px-3 py-2 mb-3 bg-gray-900 border border-gray-700 rounded-md text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
        />

        {/* Domains list */}
        <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-700 bg-gray-900/50 p-2">
          <div className="flex flex-wrap gap-1">
            {filteredDomains.map((domain) => {
              const selected = oasfDomains.includes(domain);
              return (
                <button
                  key={domain}
                  onClick={() => toggleDomain(domain)}
                  className={`px-2 py-1 rounded text-xs transition-colors ${
                    selected
                      ? "bg-purple-600/30 border border-purple-500 text-purple-300"
                      : "bg-gray-800 border border-gray-700 text-gray-400 hover:border-gray-500"
                  }`}
                >
                  {domain}
                </button>
              );
            })}
            {filteredDomains.length === 0 && (
              <p className="px-3 py-4 text-xs text-gray-500 text-center w-full">No domains match your search</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
