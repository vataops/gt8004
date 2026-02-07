"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "./api";
import type {
  Overview,
  Channel,
  Agent,
  EscrowOverview,
  SystemEvent,
  TransactionLog,
} from "./api";

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

export function useOverview() {
  return usePolling(api.getOverview, 10_000);
}

export function useChannels() {
  return usePolling(api.getChannels, 30_000);
}

export function useChannel(id: string) {
  const fn = useCallback(() => api.getChannel(id), [id]);
  return usePolling(fn, 10_000);
}

export function useAgents() {
  return usePolling(api.getAgents, 30_000);
}

export function useAgent(id: string) {
  const fn = useCallback(() => api.getAgent(id), [id]);
  return usePolling(fn, 10_000);
}

export function useEscrow() {
  return usePolling(api.getEscrow, 15_000);
}

export function useEvents() {
  return usePolling(api.getEvents, 10_000);
}

export function useChannelTransactions(channelId: string) {
  const fn = useCallback(
    () => api.getChannelTransactions(channelId),
    [channelId]
  );
  return usePolling(fn, 10_000);
}

export function useEventStream() {
  const [events, setEvents] = useState<SystemEvent[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const wsUrl =
      process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8080";
    const ws = new WebSocket(`${wsUrl}/v1/admin/events/ws`);
    wsRef.current = ws;

    ws.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data) as SystemEvent;
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
