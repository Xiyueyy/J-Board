"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getCarrierLabel } from "./proxy-signal-grid";
import type { TraceItem } from "./trace-loader";

interface ProxyTraceDetailDialogProps {
  trace: TraceItem | null;
  onOpenChange: (open: boolean) => void;
}

export function ProxyTraceDetailDialog({ trace, onOpenChange }: ProxyTraceDetailDialogProps) {
  return (
    <Dialog open={trace !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {trace ? `${getCarrierLabel(trace.carrier)} 路由 — ${trace.summary}` : "路由详情"}
          </DialogTitle>
        </DialogHeader>
        {trace && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground mb-3">
              共 {trace.hopCount} 跳
              {trace.updatedAt && ` · 更新于 ${new Date(trace.updatedAt).toLocaleString("zh-CN")}`}
            </p>
            <div className="space-y-0.5">
              {trace.hops.map((hop) => (
                <div
                  key={`${hop.hop}-${hop.ip}`}
                  className="flex items-baseline gap-2 text-xs py-1 px-2 rounded hover:bg-muted/40"
                >
                  <span className="w-6 text-right text-muted-foreground shrink-0">
                    {hop.hop}
                  </span>
                  <span className="font-mono min-w-0 truncate">{hop.ip || "*"}</span>
                  <span className="text-muted-foreground truncate">{hop.geo}</span>
                  {hop.latency > 0 && (
                    <span className="ml-auto shrink-0 text-muted-foreground">
                      {hop.latency.toFixed(1)}ms
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
