import { Activity } from "lucide-react";
import { TrafficTrendChart } from "@/components/shared/traffic-trend-chart";
import type { TrafficTrendPoint } from "../traffic-data";

export function TrendSection({ trend }: { trend: TrafficTrendPoint[] }) {
  return (
    <div className="surface-card overflow-hidden rounded-xl p-4">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Activity className="size-4" />
        </span>
        <div>
          <h3 className="text-sm font-semibold tracking-tight">近 14 天全站流量趋势</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">用于观察全站用量变化和同步质量。</p>
        </div>
      </div>
      <TrafficTrendChart data={trend} color="oklch(0.52 0.13 172)" />
    </div>
  );
}

export function TrendSectionSkeleton() {
  return (
    <div className="surface-card rounded-xl p-4">
      <div className="mb-4 flex items-center gap-3">
        <div className="size-8 animate-pulse rounded-lg bg-muted" />
        <div className="space-y-2">
          <div className="h-4 w-40 animate-pulse rounded bg-muted" />
          <div className="h-3 w-56 animate-pulse rounded bg-muted/70" />
        </div>
      </div>
      <div className="h-[200px] animate-pulse rounded-lg bg-muted/30" />
    </div>
  );
}
