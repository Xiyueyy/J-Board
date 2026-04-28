"use client";

import { useEffect, useEffectEvent, useSyncExternalStore } from "react";
import { fetchJson } from "@/lib/fetch-json";

export interface LatencyItem {
  carrier: string;
  latencyMs: number;
}

export interface LatencyRefreshMeta {
  loading: boolean;
  updatedAt: string | null;
  nextRefreshAt: string | null;
  error: string | null;
}

type LatencyMap = Record<string, LatencyItem[]>;

const REFRESH_INTERVAL_MS = 60 * 1000;

let latencyData: LatencyMap = {};
let latencyMeta: LatencyRefreshMeta = {
  loading: false,
  updatedAt: null,
  nextRefreshAt: null,
  error: null,
};
const listeners = new Set<() => void>();

function getSnapshot(): LatencyMap {
  return latencyData;
}

function getMetaSnapshot(): LatencyRefreshMeta {
  return latencyMeta;
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function emit() {
  for (const cb of listeners) cb();
}

function setLatencyData(data: LatencyMap) {
  latencyData = data;
  emit();
}

function setLatencyMeta(meta: Partial<LatencyRefreshMeta>) {
  latencyMeta = { ...latencyMeta, ...meta };
  emit();
}

export function useLatency(nodeId: string | null): LatencyItem[] {
  const data = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return nodeId ? data[nodeId] ?? [] : [];
}

export function useLatencyRefreshMeta(): LatencyRefreshMeta {
  return useSyncExternalStore(subscribe, getMetaSnapshot, getMetaSnapshot);
}

export function LatencyLoader({ nodeIds }: { nodeIds: string[] }) {
  const nodeIdKey = nodeIds.join(",");
  const load = useEffectEvent(async () => {
    if (!nodeIdKey) return;

    setLatencyMeta({ loading: true, error: null });
    try {
      const result = await fetchJson<LatencyMap>(`/api/latency?nodeIds=${nodeIdKey}`);
      const now = Date.now();
      setLatencyData(result);
      setLatencyMeta({
        loading: false,
        updatedAt: new Date(now).toISOString(),
        nextRefreshAt: new Date(now + REFRESH_INTERVAL_MS).toISOString(),
        error: null,
      });
    } catch {
      setLatencyMeta({
        loading: false,
        error: "线路体验暂时无法刷新，稍后会自动重试。",
      });
    }
  });

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [nodeIdKey]);

  return null;
}
