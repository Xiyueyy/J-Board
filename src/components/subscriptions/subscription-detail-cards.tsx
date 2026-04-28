import type { SubscriptionStatus, SubscriptionType } from "@prisma/client";
import { Activity, CalendarClock, Database, Server } from "lucide-react";
import { DetailItem, DetailList } from "@/components/shared/detail-list";
import {
  SubscriptionStatusBadge,
  SubscriptionTypeBadge,
} from "@/components/shared/domain-badges";
import { formatBytes, formatDate } from "@/lib/utils";

interface SubscriptionDetailPlan {
  name: string;
  type: SubscriptionType;
}

interface SubscriptionDetailNodeClient {
  email?: string | null;
  inbound: {
    protocol: string;
    tag: string;
    server: {
      name: string;
    };
  };
}

interface SubscriptionDetailStreamingSlot {
  service: {
    name: string;
  };
}

interface SubscriptionDetailItem {
  status: SubscriptionStatus;
  startDate: Date;
  endDate: Date;
  trafficUsed: bigint | number;
  trafficLimit: bigint | number | null;
  plan: SubscriptionDetailPlan;
  nodeClient?: SubscriptionDetailNodeClient | null;
  streamingSlot?: SubscriptionDetailStreamingSlot | null;
}

export function SubscriptionDetailCards({
  subscription,
  showClientEmail = false,
}: {
  subscription: SubscriptionDetailItem;
  showClientEmail?: boolean;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
      <section className="surface-card overflow-hidden rounded-xl p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Activity className="size-4" />
            </div>
            <div>
              <h3 className="text-lg font-semibold tracking-[-0.02em]">订阅信息</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">有效期、类型和流量配额集中在这里。</p>
            </div>
          </div>
          <SubscriptionStatusBadge status={subscription.status} />
        </div>
        <DetailList>
          <DetailItem label="类型">
            <SubscriptionTypeBadge type={subscription.plan.type} />
          </DetailItem>
          <DetailItem label="开始时间">
            <span className="inline-flex items-center gap-2"><CalendarClock className="size-4 text-primary" />{formatDate(subscription.startDate)}</span>
          </DetailItem>
          <DetailItem label="到期时间">{formatDate(subscription.endDate)}</DetailItem>
          <DetailItem label="已用流量">
            <span className="inline-flex items-center gap-2"><Database className="size-4 text-primary" />{formatBytes(subscription.trafficUsed)}</span>
          </DetailItem>
          <DetailItem label="总流量" className="sm:col-span-2">
            {subscription.trafficLimit ? formatBytes(subscription.trafficLimit) : "无限"}
          </DetailItem>
        </DetailList>
      </section>

      <section className="surface-card overflow-hidden rounded-xl p-5">
        <div className="mb-4 space-y-1.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Server className="size-4" />
          </div>
          <div>
            <h3 className="text-lg font-semibold tracking-[-0.02em]">资源信息</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">确认当前分配的节点、入站或流媒体服务。</p>
          </div>
        </div>
        {subscription.plan.type === "PROXY" ? (
          <DetailList>
            <DetailItem label="节点">
              {subscription.nodeClient?.inbound.server.name ?? "未分配"}
            </DetailItem>
            <DetailItem label="入站">
              {subscription.nodeClient
                ? `${subscription.nodeClient.inbound.protocol} · ${subscription.nodeClient.inbound.tag}`
                : "—"}
            </DetailItem>
            {showClientEmail && (
              <DetailItem label="客户端" className="sm:col-span-2">
                {subscription.nodeClient?.email ?? "—"}
              </DetailItem>
            )}
          </DetailList>
        ) : (
          <DetailList>
            <DetailItem label="服务" className="sm:col-span-2">
              {subscription.streamingSlot?.service.name ?? "未分配"}
            </DetailItem>
          </DetailList>
        )}
      </section>
    </div>
  );
}
