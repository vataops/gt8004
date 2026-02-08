"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { openApi, liteApi } from "./api";
import type { WsEvent } from "./api";

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

// ========== Open Hooks ==========

export function useOverview() {
  return usePolling(openApi.getOverview, 10_000);
}

export function useAgents(category?: string) {
  const fn = useCallback(() => openApi.searchAgents(category), [category]);
  return usePolling(fn, 30_000);
}

export function useCustomers(agentId: string) {
  const fn = useCallback(() => openApi.getCustomers(agentId), [agentId]);
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

export function useAlerts(agentId: string) {
  const fn = useCallback(() => openApi.getAlerts(agentId), [agentId]);
  return usePolling(fn, 30_000);
}

export function useAlertHistory(agentId: string) {
  const fn = useCallback(() => openApi.getAlertHistory(agentId), [agentId]);
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

export function useLogs(agentId: string, limit = 50) {
  const fn = useCallback(() => openApi.getLogs(agentId, limit), [agentId, limit]);
  return usePolling(fn, 10_000);
}

// ========== Lite Hooks ==========

export function useLiteOverview() {
  return usePolling(liteApi.getOverview, 10_000);
}

export function useChannels() {
  return usePolling(liteApi.getChannels, 30_000);
}

export function useChannel(id: string) {
  const fn = useCallback(() => liteApi.getChannel(id), [id]);
  return usePolling(fn, 10_000);
}

export function useLiteAgents() {
  return usePolling(liteApi.getAgents, 30_000);
}

export function useLiteAgent(id: string) {
  const fn = useCallback(() => liteApi.getAgent(id), [id]);
  return usePolling(fn, 10_000);
}

export function useEscrow() {
  return usePolling(liteApi.getEscrow, 15_000);
}

export function useEvents() {
  return usePolling(liteApi.getEvents, 10_000);
}

export function useChannelTransactions(channelId: string) {
  const fn = useCallback(
    () => liteApi.getChannelTransactions(channelId),
    [channelId]
  );
  return usePolling(fn, 10_000);
}

export function useEventStream() {
  const [events, setEvents] = useState<WsEvent[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const wsUrl =
      process.env.NEXT_PUBLIC_LITE_WS_URL || "ws://localhost:8081";
    const ws = new WebSocket(`${wsUrl}/v1/admin/events/ws`);
    wsRef.current = ws;

    ws.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data) as WsEvent;
        setEvents((prev) => [event, ...prev].slice(0, 500));
      } catch {
        // ignore parse errors
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  return { events };
}
