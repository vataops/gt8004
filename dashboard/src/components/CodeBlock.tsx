"use client";

import { CopyButton } from "./CopyButton";

export function CodeBlock({ code, label }: { code: string; label?: string }) {
  return (
    <div className="rounded-lg border border-[#1a1a1a] bg-[#0f0f0f] overflow-hidden">
      {label && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-[#1a1a1a]">
          <span className="text-xs text-zinc-500">{label}</span>
          <CopyButton text={code} />
        </div>
      )}
      <pre className="p-4 text-sm text-gray-300 overflow-x-auto">
        <code>{code}</code>
      </pre>
      {!label && (
        <div className="px-4 pb-3">
          <CopyButton text={code} />
        </div>
      )}
    </div>
  );
}
