import type { LucidEvolution } from '@lucid-evolution/lucid';
export function initLucid(network?: string): Promise<LucidEvolution>;
export function connectLace(): Promise<{ address: string; network: string }>;
export function getLucid(): LucidEvolution | null;
