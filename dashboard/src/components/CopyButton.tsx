"use client";

import { useState } from "react";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="px-2 py-1 text-xs rounded bg-[#1a1a1a] hover:bg-[#00FFE0]/10 text-gray-300 hover:text-[#00FFE0] transition-colors"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}
