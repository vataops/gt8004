"use client";

import { useState, useEffect, useCallback } from "react";
import { openApi } from "./api";

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
    limit?: number;
    offset?: number;
  } = {}
) {
  const fn = useCallback(
    () => openApi.getNetworkAgents(params),
    [params.chain_id, params.search, params.limit, params.offset]
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

// ========== Agent Analytics Hooks (public, by agent_id) ==========

export function useAgentStats(agentId: string) {
  const fn = useCallback(
    () => openApi.getStats(agentId),
    [agentId]
  );
  return usePolling(fn, 15_000);
}

export function useDailyStats(agentId: string, days = 30) {
  const fn = useCallback(
    () => openApi.getDailyStats(agentId, days),
    [agentId, days]
  );
  return usePolling(fn, 60_000);
}

export function useCustomers(agentId: string) {
  const fn = useCallback(
    () => openApi.getCustomers(agentId),
    [agentId]
  );
  return usePolling(fn, 30_000);
}

export function useRevenue(agentId: string, period = "monthly") {
  const fn = useCallback(
    () => openApi.getRevenue(agentId, period),
    [agentId, period]
  );
  return usePolling(fn, 30_000);
}

export function usePerformance(agentId: string, window = "24h") {
  const fn = useCallback(
    () => openApi.getPerformance(agentId, window),
    [agentId, window]
  );
  return usePolling(fn, 15_000);
}

export function useLogs(agentId: string, limit = 50) {
  const fn = useCallback(
    () => openApi.getLogs(agentId, limit),
    [agentId, limit]
  );
  return usePolling(fn, 10_000);
}

export function useAnalytics(agentId: string, days = 30) {
  const fn = useCallback(
    () => openApi.getAnalytics(agentId, days),
    [agentId, days]
  );
  return usePolling(fn, 15_000);
}

export function useFunnel(agentId: string, days = 30) {
  const fn = useCallback(
    () => openApi.getFunnel(agentId, days),
    [agentId, days]
  );
  return usePolling(fn, 30_000);
}

// ========== Customer Detail Hooks ==========

export function useCustomerLogs(agentId: string, customerId: string) {
  const fn = useCallback(
    () => openApi.getCustomerLogs(agentId, customerId),
    [agentId, customerId]
  );
  return usePolling(fn, 10_000);
}

export function useCustomerTools(agentId: string, customerId: string) {
  const fn = useCallback(
    () => openApi.getCustomerTools(agentId, customerId),
    [agentId, customerId]
  );
  return usePolling(fn, 30_000);
}

export function useCustomerDaily(agentId: string, customerId: string, days = 30) {
  const fn = useCallback(
    () => openApi.getCustomerDaily(agentId, customerId, days),
    [agentId, customerId, days]
  );
  return usePolling(fn, 60_000);
}
