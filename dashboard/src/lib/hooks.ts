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

export function useBenchmarkCategories() {
  return usePolling(openApi.getBenchmarkCategories, 60_000);
}

export function useBenchmark(category: string) {
  const fn = useCallback(() => openApi.getBenchmark(category), [category]);
  return usePolling(fn, 60_000);
}

// ========== Authenticated Hooks ==========

export function useCustomers(agentId: string, apiKey: string) {
  const fn = useCallback(
    () => openApi.getCustomers(agentId, apiKey),
    [agentId, apiKey]
  );
  return usePolling(fn, 30_000);
}

export function useRevenue(agentId: string, apiKey: string, period = "monthly") {
  const fn = useCallback(
    () => openApi.getRevenue(agentId, apiKey, period),
    [agentId, apiKey, period]
  );
  return usePolling(fn, 30_000);
}

export function usePerformance(agentId: string, apiKey: string, window = "24h") {
  const fn = useCallback(
    () => openApi.getPerformance(agentId, apiKey, window),
    [agentId, apiKey, window]
  );
  return usePolling(fn, 15_000);
}

export function useAlerts(agentId: string, apiKey: string) {
  const fn = useCallback(
    () => openApi.getAlerts(agentId, apiKey),
    [agentId, apiKey]
  );
  return usePolling(fn, 30_000);
}

export function useAlertHistory(agentId: string, apiKey: string) {
  const fn = useCallback(
    () => openApi.getAlertHistory(agentId, apiKey),
    [agentId, apiKey]
  );
  return usePolling(fn, 30_000);
}

export function useLogs(agentId: string, apiKey: string, limit = 50) {
  const fn = useCallback(
    () => openApi.getLogs(agentId, apiKey, limit),
    [agentId, apiKey, limit]
  );
  return usePolling(fn, 10_000);
}
