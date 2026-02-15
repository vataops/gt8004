const colors: Record<string, string> = {
  low: "bg-green-900/30 text-green-400",
  medium: "bg-yellow-900/30 text-yellow-400",
  high: "bg-red-900/30 text-red-400",
  cyan: "bg-[#00FFE0]/10 text-[#00FFE0] border border-[#00FFE0]/30",
};

export function Badge({
  label,
  variant = "low",
}: {
  label: string;
  variant?: string;
}) {
  return (
    <span
      className={`px-2 py-0.5 rounded text-xs ${colors[variant] || colors.low}`}
    >
      {label}
    </span>
  );
}
