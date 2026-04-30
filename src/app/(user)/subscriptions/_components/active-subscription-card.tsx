import Link from "next/link";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { ArrowUpRight, CalendarClock, Database, Radio, Server, Tv } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { QrPreview } from "@/components/shared/qr-preview";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatBytes } from "@/lib/utils";
import { SubscriptionActions } from "../subscription-actions";
import { withSubscriptionFormat } from "./subscription-import-actions";
import {
  getPlanTypeLabel,
  getPlanTypeTone,
  getTrafficPoolRemainingGb,
} from "../subscriptions-calculations";
import type { SubscriptionRecord } from "../subscriptions-types";
import type { PlanTrafficPoolState } from "@/services/plan-traffic-pool";

interface ActiveSubscriptionCardProps {
  sub: SubscriptionRecord;
  baseUrl: string;
  poolMap: Map<string, PlanTrafficPoolState>;
}

function getInboundDisplayName(sub: SubscriptionRecord) {
  const settings = sub.nodeClient?.inbound.settings;
  if (settings && typeof settings === "object" && "displayName" in settings) {
    const value = (settings as { displayName?: unknown }).displayName;
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return sub.nodeClient?.inbound.tag ?? "等待分配";
}

function ProxyCompactSummary({ sub }: { sub: SubscriptionRecord }) {
  if (sub.plan.type !== "PROXY") return null;

  const used = Number(sub.trafficUsed);
  const limit = sub.trafficLimit ? Number(sub.trafficLimit) : null;
  const percent = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const nodeName = sub.nodeClient?.inbound.server.name ?? sub.plan.node?.name ?? "待分配";
  const inboundName = getInboundDisplayName(sub);
  const protocol = sub.nodeClient?.inbound.protocol ?? "—";
  const port = sub.nodeClient?.inbound.port ?? null;

  return (
    <div className="space-y-3 rounded-xl border border-border bg-muted/25 p-3">
      <div className="grid gap-2 text-xs sm:grid-cols-2">
        <div className="rounded-lg bg-background/70 px-3 py-2">
          <p className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Server className="size-3.5 text-primary" /> 节点
          </p>
          <p className="mt-1 truncate font-semibold">{nodeName}</p>
        </div>
        <div className="rounded-lg bg-background/70 px-3 py-2">
          <p className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Radio className="size-3.5 text-primary" /> 入站
          </p>
          <p className="mt-1 truncate font-semibold">{protocol}{port ? ` · ${port}` : ""}</p>
        </div>
      </div>

      <div className="rounded-lg bg-background/70 px-3 py-2">
        <div className="mb-2 flex items-center justify-between gap-2 text-xs">
          <span className="inline-flex min-w-0 items-center gap-1.5 text-muted-foreground">
            <Database className="size-3.5 text-primary" />
            <span className="truncate">{inboundName}</span>
          </span>
          {limit && <span className="font-semibold text-primary tabular-nums">{percent}%</span>}
        </div>
        {limit ? (
          <>
            <Progress value={percent} />
            <p className="mt-2 text-xs text-muted-foreground">
              {formatBytes(used)} / {formatBytes(limit)}
            </p>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">不限流量 · 已用 {formatBytes(used)}</p>
        )}
      </div>
    </div>
  );
}

function StreamingCompactSummary({ sub }: { sub: SubscriptionRecord }) {
  if (sub.plan.type !== "STREAMING") return null;

  return (
    <div className="rounded-xl border border-border bg-muted/25 p-3">
      <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Tv className="size-3.5 text-primary" /> 流媒体服务
      </p>
      <p className="mt-1 text-sm font-semibold">{sub.streamingSlot?.service.name ?? "账号分配中"}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">账号凭据和使用说明请进入详情页查看。</p>
    </div>
  );
}

function MobileSubscriptionQr({ sub, baseUrl }: { sub: SubscriptionRecord; baseUrl: string }) {
  if (sub.plan.type !== "PROXY" || !sub.nodeClient || !baseUrl) return null;

  const subUrl = `${baseUrl}/api/subscription/${sub.id}?token=${sub.downloadToken}`;
  const clashUrl = withSubscriptionFormat(subUrl, "clash");

  return (
    <div className="md:hidden">
      <QrPreview
        label="Clash 订阅二维码"
        value={clashUrl}
        alt="Clash 订阅二维码"
        className="bg-background/75"
      />
    </div>
  );
}

export function ActiveSubscriptionCard({ sub, baseUrl, poolMap }: ActiveSubscriptionCardProps) {
  return (
    <Card className="group overflow-hidden transition-colors duration-200 hover:border-primary/25 hover:bg-muted/10">
      <CardHeader className="gap-3 p-4 pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {sub.plan.type === "PROXY" ? <Radio className="size-4" /> : <Tv className="size-4" />}
            </span>
            <div className="min-w-0 space-y-1.5">
              <CardTitle className="text-base">
                <Link
                  href={`/subscriptions/${sub.id}`}
                  className="group/link inline-flex max-w-full items-center gap-1.5 hover:text-primary"
                >
                  <span className="truncate">{sub.plan.name}</span>
                  <ArrowUpRight className="size-3.5 opacity-45 transition-transform duration-300 group-hover/link:-translate-y-0.5 group-hover/link:translate-x-0.5 group-hover/link:opacity-100" />
                </Link>
              </CardTitle>
              <p className="inline-flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarClock className="size-3.5" />
                {format(sub.endDate, "yyyy-MM-dd", { locale: zhCN })} 到期
              </p>
            </div>
          </div>
          <StatusBadge tone={getPlanTypeTone(sub.plan.type)} className="h-6 px-2 text-[11px]">
            {getPlanTypeLabel(sub.plan.type)}
          </StatusBadge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-1">
        <ProxyCompactSummary sub={sub} />
        <StreamingCompactSummary sub={sub} />
        <MobileSubscriptionQr sub={sub} baseUrl={baseUrl} />
        <SubscriptionActions
          subscriptionId={sub.id}
          type={sub.plan.type}
          allowRenewal={sub.plan.allowRenewal}
          allowTrafficTopup={sub.plan.type === "PROXY" && sub.plan.allowTrafficTopup}
          trafficPoolRemainingGb={getTrafficPoolRemainingGb(sub, poolMap)}
          renewalConfig={{
            durationDays: sub.plan.durationDays,
            renewalPrice: sub.plan.renewalPrice == null ? null : Number(sub.plan.renewalPrice),
            renewalPricingMode: sub.plan.renewalPricingMode,
            renewalDurationDays: sub.plan.renewalDurationDays,
            renewalMinDays: sub.plan.renewalMinDays,
            renewalMaxDays: sub.plan.renewalMaxDays,
          }}
          topupConfig={{
            topupPricingMode: sub.plan.topupPricingMode,
            topupPricePerGb: sub.plan.topupPricePerGb == null ? null : Number(sub.plan.topupPricePerGb),
            topupFixedPrice: sub.plan.topupFixedPrice == null ? null : Number(sub.plan.topupFixedPrice),
            minTopupGb: sub.plan.minTopupGb,
            maxTopupGb: sub.plan.maxTopupGb,
          }}
        />
      </CardContent>
    </Card>
  );
}
