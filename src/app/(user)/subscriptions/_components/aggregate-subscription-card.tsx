import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { CalendarClock, Gauge, Layers3, Sparkles } from "lucide-react";
import { QrPreview } from "@/components/shared/qr-preview";
import { Progress } from "@/components/ui/progress";
import { formatBytes } from "@/lib/utils";
import { SubscriptionImportActions, withSubscriptionFormat } from "./subscription-import-actions";

interface AggregateSubscriptionCardProps {
  subscriptionUrl: string;
  nodeCount: number;
  totalUsed: bigint;
  totalLimit: bigint | null;
  nextExpiry: Date | null;
}

export function AggregateSubscriptionCard({
  subscriptionUrl,
  nodeCount,
  totalUsed,
  totalLimit,
  nextExpiry,
}: AggregateSubscriptionCardProps) {
  const percent = totalLimit
    ? Math.min(100, Math.round((Number(totalUsed) / Number(totalLimit)) * 100))
    : 0;
  const clashUrl = withSubscriptionFormat(subscriptionUrl, "clash");

  return (
    <section className="relative overflow-hidden rounded-2xl border border-primary/15 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.16),transparent_34%),linear-gradient(135deg,hsl(var(--card)),hsl(var(--muted)/0.35))] p-5 shadow-sm sm:p-6">
      <div className="absolute right-8 top-8 size-32 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-start">
        <div className="space-y-5">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Sparkles className="size-3.5" /> 总订阅链接
            </div>
            <div className="max-w-2xl space-y-2">
              <h2 className="text-2xl font-semibold tracking-[-0.04em] text-balance sm:text-3xl">
                一个链接导入全部节点
              </h2>
              <p className="text-sm leading-6 text-muted-foreground text-pretty">
                新购买的代理节点会自动加入这个链接；到期或停用的节点会自动从订阅内容中移除，不需要重复导入。
              </p>
            </div>
          </div>

          <SubscriptionImportActions genericUrl={subscriptionUrl} clashUrl={clashUrl} />

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border/70 bg-background/65 p-3">
              <p className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Layers3 className="size-3.5 text-primary" /> 已合并节点
              </p>
              <p className="mt-1 text-xl font-semibold tracking-[-0.04em] tabular-nums">{nodeCount}</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/65 p-3">
              <p className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Gauge className="size-3.5 text-primary" /> 总用量
              </p>
              <p className="mt-1 text-xl font-semibold tracking-[-0.04em] tabular-nums">{formatBytes(totalUsed)}</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/65 p-3">
              <p className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <CalendarClock className="size-3.5 text-primary" /> 最近到期
              </p>
              <p className="mt-1 text-sm font-semibold tabular-nums">
                {nextExpiry ? format(nextExpiry, "MM-dd HH:mm", { locale: zhCN }) : "—"}
              </p>
            </div>
          </div>

          {totalLimit && (
            <div className="rounded-xl border border-border/70 bg-background/65 p-3">
              <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>合计流量进度</span>
                <span className="font-semibold text-primary tabular-nums">{percent}%</span>
              </div>
              <Progress value={percent} />
              <p className="mt-2 text-xs text-muted-foreground">
                总额度 {formatBytes(totalLimit)} · 剩余 {formatBytes(totalLimit - totalUsed > BigInt(0) ? totalLimit - totalUsed : BigInt(0))}
              </p>
            </div>
          )}
        </div>

        <div className="lg:sticky lg:top-24">
          <QrPreview label="Clash 订阅二维码" value={clashUrl} alt="Clash 订阅链接二维码" />
        </div>
      </div>
    </section>
  );
}
