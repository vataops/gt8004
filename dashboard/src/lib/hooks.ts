"use client";

import { useState, useEffect, useCallback } from "react";
import { openApi } from "./api";
import { fetchOnChainActivity } from "./etherscan";

type Auth = string | { walletAddress: string };

function usePolling<T>(fetchFn: () => Promise<T>, intervalMs: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const result = await fetchFn();
      setData(result);
      setError(null);
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, [fetchFn]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, intervalMs);
    return () => clearInterval(id);
  }, [refresh, intervalMs]);

  return { data, error, loading, refresh };
}

// ========== Public Hooks ==========

export function useOverview() {
  return usePolling(openApi.getOverview, 10_000);
}

export function useAgents(category?: string) {
  const fn = useCallback(() => openApi.searchAgents(category), [category]);
  return usePolling(fn, 30_000);
}

export function useDiscovery(
  params: {
    category?: string;
    protocol?: string;
    min_reputation?: number;
    sort?: string;
  } = {}
) {
  const fn = useCallback(
    () => openApi.searchAgentsAdvanced(params),
    [params.category, params.protocol, params.min_reputation, params.sort]
  );
  return usePolling(fn, 30_000);
}

export function useNetworkAgents(
  params: {
    chain_id?: number;
    search?: string;
    owner?: string;
    limit?: number;
    offset?: number;
    sort?: string;
  } = {}
) {
  const fn = useCallback(
    () => openApi.getNetworkAgents(params),
    [params.chain_id, params.search, params.owner, params.limit, params.offset, params.sort]
  );
  return usePolling(fn, 30_000);
}

export function useNetworkAgent(chainId: number, tokenId: number) {
  const fn = useCallback(
    () => openApi.getNetworkAgent(chainId, tokenId),
    [chainId, tokenId]
  );
  return usePolling(fn, 30_000);
}

export function useNetworkStats() {
  return usePolling(openApi.getNetworkStats, 30_000);
}

export function useBenchmarkCategories() {
  return usePolling(openApi.getBenchmarkCategories, 60_000);
}

export function useBenchmark(category: string) {
  const fn = useCallback(() => openApi.getBenchmark(category), [category]);
  return usePolling(fn, 60_000);
}

// ========== Agent Analytics Hooks (owner-authenticated) ==========

export function useAgentStats(agentId: string, auth: Auth | null) {
  const fn = useCallback(
    () => auth ? openApi.getStats(agentId, auth) : Promise.resolve(null),
    [agentId, auth]
  );
  return usePolling(fn, 15_000);
}

export function useDailyStats(agentId: string, auth: Auth | null, days = 30) {
  const fn = useCallback(
    () => auth ? openApi.getDailyStats(agentId, auth, days) : Promise.resolve(null),
    [agentId, auth, days]
  );
  return usePolling(fn, 60_000);
}

export function useCustomers(agentId: string, auth: Auth | null) {
  const fn = useCallback(
    () => auth ? openApi.getCustomers(agentId, auth) : Promise.resolve(null),
    [agentId, auth]
  );
  return usePolling(fn, 30_000);
}

export function useRevenue(agentId: string, auth: Auth | null, period = "monthly") {
  const fn = useCallback(
    () => auth ? openApi.getRevenue(agentId, auth, period) : Promise.resolve(null),
    [agentId, auth, period]
  );
  return usePolling(fn, 30_000);
}

export function usePerformance(agentId: string, auth: Auth | null, window = "24h") {
  const fn = useCallback(
    () => auth ? openApi.getPerformance(agentId, auth, window) : Promise.resolve(null),
    [agentId, auth, window]
  );
  return usePolling(fn, 15_000);
}

export function useLogs(agentId: string, auth: Auth | null, limit = 50) {
  const fn = useCallback(
    () => auth ? openApi.getLogs(agentId, auth, limit) : Promise.resolve(null),
    [agentId, auth, limit]
  );
  return usePolling(fn, 10_000);
}

export function useAnalytics(agentId: string, auth: Auth | null, days = 30) {
  const fn = useCallback(
    () => auth ? openApi.getAnalytics(agentId, auth, days) : Promise.resolve(null),
    [agentId, auth, days]
  );
  return usePolling(fn, 15_000);
}

export function useFunnel(agentId: string, auth: Auth | null, days = 30) {
  const fn = useCallback(
    () => auth ? openApi.getFunnel(agentId, auth, days) : Promise.resolve(null),
    [agentId, auth, days]
  );
  return usePolling(fn, 30_000);
}

// ========== Customer Detail Hooks ==========

export function useCustomerLogs(agentId: string, customerId: string, auth: Auth | null) {
  const fn = useCallback(
    () => auth ? openApi.getCustomerLogs(agentId, customerId, auth) : Promise.resolve(null),
    [agentId, customerId, auth]
  );
  return usePolling(fn, 10_000);
}

export function useCustomerTools(agentId: string, customerId: string, auth: Auth | null) {
  const fn = useCallback(
    () => auth ? openApi.getCustomerTools(agentId, customerId, auth) : Promise.resolve(null),
    [agentId, customerId, auth]
  );
  return usePolling(fn, 30_000);
}

export function useCustomerDaily(agentId: string, customerId: string, auth: Auth | null, days = 30) {
  const fn = useCallback(
    () => auth ? openApi.getCustomerDaily(agentId, customerId, auth, days) : Promise.resolve(null),
    [agentId, customerId, auth, days]
  );
  return usePolling(fn, 60_000);
}

// ========== Wallet Analytics Hooks ==========

export function useWalletStats(address: string | null, auth: Auth | null) {
  const fn = useCallback(
    () => (address && auth ? openApi.getWalletStats(address, auth) : Promise.resolve(null)),
    [address, auth]
  );
  return usePolling(fn, 15_000);
}

export function useWalletDailyStats(address: string | null, auth: Auth | null, days = 30) {
  const fn = useCallback(
    () => (address && auth ? openApi.getWalletDailyStats(address, auth, days) : Promise.resolve(null)),
    [address, auth, days]
  );
  return usePolling(fn, 60_000);
}

export function useWalletErrors(address: string | null, auth: Auth | null) {
  const fn = useCallback(
    () => (address && auth ? openApi.getWalletErrors(address, auth) : Promise.resolve(null)),
    [address, auth]
  );
  return usePolling(fn, 30_000);
}

// ========== On-Chain Activity Hooks ==========

export function useOnChainActivity(chainId: number, address: string | undefined) {
  const fn = useCallback(
    () => (address ? fetchOnChainActivity(chainId, address) : Promise.resolve(null)),
    [chainId, address]
  );
  return usePolling(fn, 90_000);
}
