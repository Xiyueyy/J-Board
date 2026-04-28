"use client";

import { Activity, Clock3, RefreshCw, Route } from "lucide-react";
import { useLatencyRefreshMeta, type LatencyItem } from "./latency-loader";
import type { TraceItem } from "./trace-loader";
import { cn } from "@/lib/utils";

const carrierLabels: Record<string, string> = {
  telecom: "电信",
  unicom: "联通",
  mobile: "移动",
};

const CARRIER_ORDER: string[] = ["telecom", "unicom", "mobile"];

function sortByCarrier<T extends { carrier: string }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => (CARRIER_ORDER.indexOf(a.carrier) >>> 0) - (CARRIER_ORDER.indexOf(b.carrier) >>> 0),
  );
}

export function getCarrierLabel(carrier: string) {
  return carrierLabels[carrier] ?? carrier.replace("中国", "");
}

function formatRefreshLabel(meta: ReturnType<typeof useLatencyRefreshMeta>) {
  if (meta.loading) return "正在刷新";
  if (!meta.updatedAt) return "约 1 分钟更新";

  const updatedAt = new Date(meta.updatedAt);
  const nextRefreshAt = meta.nextRefreshAt ? new Date(meta.nextRefreshAt) : null;
  const updated = updatedAt.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  const next = nextRefreshAt?.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  return next ? `${updated} 更新 · ${next} 再刷` : `${updated} 已更新`;
}

export function ProxySignalPanel({
  latencyItems,
  traceItems,
  onTraceSelect,
  onLatencyClick,
}: {
  latencyItems: LatencyItem[];
  traceItems: TraceItem[];
  onTraceSelect: (item: TraceItem) => void;
  onLatencyClick?: () => void;
}) {
  const refreshMeta = useLatencyRefreshMeta();

  if (latencyItems.length === 0 && traceItems.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-sm leading-6 text-muted-foreground">
        线路数据采集中，可先购买，开通后在订阅页查看连接状态。
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-muted/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-2 text-sm font-semibold">
            <Activity className="size-4 text-primary" /> 线路体验
          </p>
          <p className="mt-1 text-xs text-muted-foreground">延迟与访问路径会持续更新，帮助你选择更舒服的线路。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/15 bg-primary/10 px-2.5 py-1 text-[0.68rem] font-semibold text-primary">
            {refreshMeta.loading ? <RefreshCw className="size-3 animate-spin" /> : <Clock3 className="size-3" />}
            {formatRefreshLabel(refreshMeta)}
          </div>
          {refreshMeta.error && (
            <div className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[0.68rem] font-semibold text-amber-700 dark:text-amber-300">
              自动重试中
            </div>
          )}
        </div>
      </div>

      {latencyItems.length > 0 && <ProxyLatencyGrid items={latencyItems} onClick={onLatencyClick} />}
      {traceItems.length > 0 && <ProxyTraceGrid items={traceItems} onTraceSelect={onTraceSelect} />}
    </div>
  );
}

export function ProxyLatencyGrid({ items, onClick }: { items: LatencyItem[]; onClick?: () => void }) {
  if (items.length === 0) return null;

  const sorted = sortByCarrier(items);
  const bestLatency = Math.min(...sorted.map((item) => item.latencyMs));

  return (
    <div className="space-y-2">
      <p className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-muted-foreground">
        <Activity className="size-3.5" /> 延迟{onClick && <span className="font-normal">· 点击查看趋势</span>}
      </p>
      <div className={cn("grid grid-cols-3 gap-2", onClick && "cursor-pointer")} onClick={onClick}>
        {sorted.map((item) => {
          const strong = item.latencyMs === bestLatency;
          return (
            <div
              key={item.carrier}
              className={cn(
                "rounded-lg border px-3 py-3 text-center transition-colors duration-200",
                strong ? "border-primary/20 bg-primary/10 text-primary" : "border-border bg-background",
                onClick && "hover:border-primary/25 hover:bg-primary/7",
              )}
            >
              <p className="text-[11px] font-semibold leading-tight text-muted-foreground">
                {getCarrierLabel(item.carrier)}
              </p>
              <p className="mt-1 text-xl font-semibold tracking-tight tabular-nums">
                {item.latencyMs}
                <span className="ml-0.5 text-xs font-normal text-muted-foreground">ms</span>
              </p>
              {strong && <p className="mt-1 text-[10px] font-semibold tracking-[0.14em]">BEST</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ProxyTraceGrid({
  items,
  onTraceSelect,
}: {
  items: TraceItem[];
  onTraceSelect: (item: TraceItem) => void;
}) {
  if (items.length === 0) return null;

  const sorted = sortByCarrier(items);

  return (
    <div className="space-y-2">
      <p className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-muted-foreground">
        <Route className="size-3.5" /> 访问路径
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        {sorted.map((item) => (
          <button
            key={item.carrier}
            type="button"
            className="group rounded-lg border border-border bg-background px-3 py-3 text-left transition-colors duration-200 hover:border-primary/25 hover:bg-primary/7 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/20"
            onClick={(event) => {
              event.stopPropagation();
              onTraceSelect(item);
            }}
          >
            <p className="text-[11px] font-semibold text-muted-foreground">
              {getCarrierLabel(item.carrier)} · {item.hopCount} 跳
            </p>
            <p className="mt-1 truncate text-xs font-semibold tracking-tight group-hover:text-primary">
              {item.summary}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
