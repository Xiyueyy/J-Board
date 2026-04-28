"use client";

import { useEffect, useEffectEvent, useSyncExternalStore } from "react";
import { fetchJson } from "@/lib/fetch-json";

export interface HopDetail {
  hop: number;
  ip: string;
  geo: string;
  latency: number;
}

export interface TraceItem {
  carrier: string;
  summary: string;
  hopCount: number;
  hops: HopDetail[];
  updatedAt: string;
}

type TraceMap = Record<string, TraceItem[]>;

let traceData: TraceMap = {};
const listeners = new Set<() => void>();

function getSnapshot(): TraceMap {
  return traceData;
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function setTraceData(data: TraceMap) {
  traceData = data;
  for (const cb of listeners) cb();
}

export function useTraces(nodeId: string | null): TraceItem[] {
  const data = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return nodeId ? data[nodeId] ?? [] : [];
}

export function TraceLoader({ nodeIds }: { nodeIds: string[] }) {
  const nodeIdKey = nodeIds.join(",");
  const load = useEffectEvent(async () => {
    if (!nodeIdKey) return;
    try {
      const result = await fetchJson<TraceMap>(
        `/api/traces?nodeIds=${nodeIdKey}`,
      );
      setTraceData(result);
    } catch {
      // Trace data is non-critical — silently ignore
    }
  });

  useEffect(() => {
    void load();
  }, [nodeIdKey]);

  return null;
}
