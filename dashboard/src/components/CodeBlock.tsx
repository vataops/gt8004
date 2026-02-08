"use client";

import { CopyButton } from "./CopyButton";

export function CodeBlock({ code, label }: { code: string; label?: string }) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 overflow-hidden">
      {label && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
          <span className="text-xs text-gray-500">{label}</span>
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
