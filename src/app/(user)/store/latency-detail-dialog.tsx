"use client";

import { startTransition, useEffect, useState } from "react";
import { Activity } from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fetchJson } from "@/lib/fetch-json";
import { cn } from "@/lib/utils";
import { getCarrierLabel } from "./proxy-signal-grid";

type Range = "1d" | "7d" | "30d";

interface HistoryData {
  carriers: string[];
  points: Record<string, string | number>[];
  sufficient: boolean;
}

const RANGE_LABELS: Record<Range, string> = { "1d": "1 天", "7d": "7 天", "30d": "30 天" };
const CARRIER_COLORS: Record<string, string> = {
  jx_telecom: "oklch(0.55 0.15 250)",
  jx_unicom: "oklch(0.55 0.15 145)",
  jx_mobile: "oklch(0.55 0.15 30)",
  sh_telecom: "oklch(0.62 0.16 250)",
  sh_unicom: "oklch(0.62 0.16 145)",
  sh_mobile: "oklch(0.62 0.16 30)",
  telecom: "oklch(0.55 0.15 250)",
  unicom: "oklch(0.55 0.15 145)",
  mobile: "oklch(0.55 0.15 30)",
};

export function LatencyDetailDialog({
  nodeId,
  open,
  onOpenChange,
}: {
  nodeId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [range, setRange] = useState<Range>("1d");
  const [data, setData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !nodeId) return;
    startTransition(() => {
      setLoading(true);
    });
    fetchJson<HistoryData>(`/api/latency/history?nodeId=${nodeId}&range=${range}`)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => {
        startTransition(() => {
          setLoading(false);
        });
      });
  }, [open, nodeId, range]);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    if (range === "1d") return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
    if (range === "7d") return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:00`;
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="inline-flex items-center gap-2">
            <Activity className="size-4 text-primary" /> 延迟趋势
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-1.5 mb-4">
          {(Object.keys(RANGE_LABELS) as Range[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                range === r
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted/70",
              )}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>

        <div className="h-[420px]">
          {loading ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">加载中...</div>
          ) : !data || data.points.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/20 text-sm text-muted-foreground">
              <Activity className="size-5" />
              <p>暂无延迟数据</p>
            </div>
          ) : !data.sufficient && range !== "1d" ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-amber-500/30 bg-amber-500/5 text-sm text-muted-foreground">
              <Activity className="size-5 text-amber-500" />
              <p>数据不足 {RANGE_LABELS[range]}，延迟记录仍在积累中</p>
              <p className="text-xs">请稍后再查看该时间范围</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.points}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" tickFormatter={formatTime} tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis unit=" ms" width={55} tick={{ fontSize: 11 }} />
                <Tooltip
                  labelFormatter={(label) => formatTime(String(label))}
                  formatter={(value, name) => [`${Number(value)} ms`, getCarrierLabel(String(name))]}
                />
                <Legend formatter={getCarrierLabel} />
                {data.carriers.map((c) => (
                  <Line
                    key={c}
                    type="monotone"
                    dataKey={c}
                    stroke={CARRIER_COLORS[c] ?? "oklch(0.5 0.1 0)"}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
