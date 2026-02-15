"use client";

import { useState } from "react";
import { resolveImageUrl } from "@/lib/networks";

export function RobotIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Antenna */}
      <line x1="12" y1="2" x2="12" y2="5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="1.5" r="1" fill="currentColor" />
      {/* Head */}
      <rect x="4" y="5" width="16" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
      {/* Eyes */}
      <circle cx="9" cy="11" r="1.8" fill="currentColor" />
      <circle cx="15" cy="11" r="1.8" fill="currentColor" />
      {/* Mouth */}
      <line x1="9" y1="15" x2="15" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      {/* Ears */}
      <rect x="1" y="9" width="2" height="4" rx="1" fill="currentColor" />
      <rect x="21" y="9" width="2" height="4" rx="1" fill="currentColor" />
    </svg>
  );
}

/**
 * Agent avatar with image fallback to RobotIcon.
 * Handles broken image URLs (e.g. localhost references in on-chain metadata).
 */
export function AgentAvatar({
  imageUrl,
  alt = "",
  size = "sm",
}: {
  imageUrl?: string | null;
  alt?: string;
  size?: "sm" | "lg";
}) {
  const [broken, setBroken] = useState(false);
  const resolved = resolveImageUrl(imageUrl ?? null);

  const isSmall = size === "sm";
  const containerClass = isSmall
    ? "w-8 h-8 rounded-md"
    : "w-16 h-16 rounded-lg";

  if (!resolved || broken) {
    return (
      <div className={`${containerClass} bg-[#141414] flex items-center justify-center text-zinc-600 shrink-0`}>
        <RobotIcon size={isSmall ? 16 : 32} />
      </div>
    );
  }

  return (
    <img
      src={resolved}
      alt={alt}
      onError={() => setBroken(true)}
      className={`${containerClass} object-cover bg-[#141414] shrink-0`}
    />
  );
}
