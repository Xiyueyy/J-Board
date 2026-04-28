import { Activity } from "lucide-react";
import type { TrafficLog } from "@prisma/client";
import { formatBytes, formatDate } from "@/lib/utils";

export function TrafficLogList({ logs }: { logs: TrafficLog[] }) {
  if (logs.length === 0) return null;

  return (
    <section className="surface-card rounded-xl p-5">
      <h3 className="mb-4 flex items-center gap-2 text-base font-semibold tracking-tight">
        <Activity className="size-4 text-primary" /> 最近流量记录
      </h3>
      <div className="space-y-2">
        {logs.map((log) => (
          <div
            key={log.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm"
          >
            <span className="text-muted-foreground">{formatDate(log.timestamp)}</span>
            <span className="font-semibold tabular-nums">
              ↑ {formatBytes(log.upload)} / ↓ {formatBytes(log.download)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function TrafficLogListSkeleton() {
  return (
    <section className="surface-card rounded-xl p-5">
      <h3 className="mb-4 flex items-center gap-2 text-base font-semibold tracking-tight">
        <Activity className="size-4 text-primary" /> 最近流量记录
      </h3>
      <div className="space-y-2">
        {[0, 1, 2].map((index) => (
          <div key={index} className="h-10 animate-pulse rounded-lg bg-muted/30" />
        ))}
      </div>
    </section>
  );
}
