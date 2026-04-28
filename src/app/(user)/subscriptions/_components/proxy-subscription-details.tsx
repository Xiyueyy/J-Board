import { Gauge, Link2, QrCode } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { CopyButton } from "@/components/shared/copy-button";
import { QrPreview } from "@/components/shared/qr-preview";
import { formatBytes } from "@/lib/utils";
import { buildSingleNodeUri } from "@/services/subscription";
import type { SubscriptionRecord } from "../subscriptions-types";

interface ProxySubscriptionDetailsProps {
  sub: SubscriptionRecord;
  baseUrl: string;
}

export function ProxySubscriptionDetails({ sub, baseUrl }: ProxySubscriptionDetailsProps) {
  if (sub.plan.type !== "PROXY") return null;

  const used = Number(sub.trafficUsed);
  const limit = sub.trafficLimit ? Number(sub.trafficLimit) : null;
  const percent = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const subUrl = `${baseUrl}/api/subscription/${sub.id}?token=${sub.downloadToken}`;
  const singleNodeUri = sub.nodeClient ? buildSingleNodeUri(sub.nodeClient) : "";

  return (
    <div className="space-y-4">
      {limit && (
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Gauge className="size-4 text-primary" /> 流量用量
            </div>
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary tabular-nums">
              {percent}%
            </span>
          </div>
          <Progress value={percent} className="h-2.5" />
          <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
            <p className="rounded-xl bg-background/45 px-3 py-2">已用 <span className="font-semibold text-foreground">{formatBytes(used)}</span></p>
            <p className="rounded-xl bg-background/45 px-3 py-2">剩余 <span className="font-semibold text-foreground">{formatBytes(Math.max(0, limit - used))}</span></p>
          </div>
        </div>
      )}

      {sub.nodeClient ? (
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Link2 className="size-4 text-primary" /> 导入信息
          </div>
          <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-border/40 bg-background/45 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground">SUBSCRIPTION URL</p>
              <p className="mt-1 truncate font-mono text-xs text-foreground/82">{subUrl}</p>
            </div>
            <CopyButton text={subUrl} />
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-muted-foreground">
            <QrCode className="size-3.5" /> 扫码导入
          </div>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <QrPreview label="订阅 URL 二维码" value={subUrl} alt="订阅 URL 二维码" />
            {singleNodeUri && (
              <QrPreview
                label="单节点 URI 二维码"
                value={singleNodeUri}
                alt="单节点 URI 二维码"
              />
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 p-3 text-sm leading-6 text-muted-foreground">
          订阅节点正在准备中，分配完成后这里会展示订阅链接与二维码。
        </div>
      )}
    </div>
  );
}
