import Link from "next/link";
import { Film, Radio, ShoppingBag } from "lucide-react";
import { EmptyState, SectionHeader } from "@/components/shared/page-shell";
import { buttonVariants } from "@/components/ui/button";
import { CollapsibleGroup } from "@/components/shared/collapsible-group";
import type { PlanTrafficPoolState } from "@/services/plan-traffic-pool";
import type { SubscriptionRecord } from "../subscriptions-types";
import { ActiveSubscriptionCard } from "./active-subscription-card";
import { AggregateSubscriptionCard } from "./aggregate-subscription-card";

interface ActiveSubscriptionsSectionProps {
  subscriptions: SubscriptionRecord[];
  aggregateSubscriptionUrl: string | null;
  poolMap: Map<string, PlanTrafficPoolState>;
}

function toBigInt(value: bigint | number | null | undefined) {
  if (typeof value === "bigint") return value;
  return BigInt(value ?? 0);
}

function groupSubscriptions(subscriptions: SubscriptionRecord[], type: "PROXY" | "STREAMING") {
  const groups = new Map<string, { title: string; subtitle: string; items: SubscriptionRecord[] }>();
  for (const sub of subscriptions.filter((item) => item.plan.type === type)) {
    const key = sub.plan.category?.id ?? `default-${type}`;
    const fallbackTitle = type === "PROXY" ? "代理连接" : "流媒体共享";
    const group = groups.get(key) ?? {
      title: sub.plan.category?.name ?? fallbackTitle,
      subtitle: "",
      items: [],
    };
    group.items.push(sub);
    groups.set(key, group);
  }
  return Array.from(groups.values()).map((g) => ({
    ...g,
    subtitle: `${g.items.length} 个订阅`,
  }));
}

function getProxySummary(subscriptions: SubscriptionRecord[]) {
  const proxySubscriptions = subscriptions.filter((sub) => sub.plan.type === "PROXY" && sub.nodeClient);
  let totalUsed = BigInt(0);
  let totalLimit = BigInt(0);
  let hasUnlimited = false;
  let nextExpiry: Date | null = null;

  for (const sub of proxySubscriptions) {
    totalUsed += toBigInt(sub.trafficUsed);
    if (sub.trafficLimit == null) {
      hasUnlimited = true;
    } else {
      totalLimit += toBigInt(sub.trafficLimit);
    }
    if (!nextExpiry || sub.endDate < nextExpiry) {
      nextExpiry = sub.endDate;
    }
  }

  return {
    nodeCount: proxySubscriptions.length,
    totalUsed,
    totalLimit: hasUnlimited ? null : totalLimit,
    nextExpiry,
  };
}

export function ActiveSubscriptionsSection({
  subscriptions,
  aggregateSubscriptionUrl,
  poolMap,
}: ActiveSubscriptionsSectionProps) {
  const proxyGroups = groupSubscriptions(subscriptions, "PROXY");
  const streamingGroups = groupSubscriptions(subscriptions, "STREAMING");
  const proxySummary = getProxySummary(subscriptions);

  return (
    <section className="space-y-5">
      <SectionHeader title="活跃订阅" />
      {subscriptions.length === 0 ? (
        <EmptyState
          eyebrow="下一步"
          icon={<ShoppingBag className="size-5" />}
          title="还没有正在使用的订阅"
          description="选择套餐并完成支付后，这里会显示统一订阅链接、节点概览和续费入口。"
          action={
            <Link href="/store" className={buttonVariants()}>
              去商店选择套餐
            </Link>
          }
        />
      ) : (
        <div className="space-y-7">
          {proxySummary.nodeCount > 0 && aggregateSubscriptionUrl && (
            <AggregateSubscriptionCard
              subscriptionUrl={aggregateSubscriptionUrl}
              nodeCount={proxySummary.nodeCount}
              totalUsed={proxySummary.totalUsed}
              totalLimit={proxySummary.totalLimit}
              nextExpiry={proxySummary.nextExpiry}
            />
          )}

          {proxyGroups.length > 0 && (
            <div className="space-y-4">
              <SectionHeader
                title="节点概览"
                description="节点卡片只保留状态、流量和操作；配置、二维码和日志放到详情页。"
                actions={<Radio className="size-5 text-primary" />}
              />
              {proxyGroups.map((group, index) => (
                <CollapsibleGroup
                  key={group.title}
                  title={group.title}
                  subtitle={group.subtitle}
                  defaultOpen={index === 0}
                >
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {group.items.map((sub) => (
                      <ActiveSubscriptionCard key={sub.id} sub={sub} poolMap={poolMap} />
                    ))}
                  </div>
                </CollapsibleGroup>
              ))}
            </div>
          )}

          {streamingGroups.length > 0 && (
            <div className="space-y-4">
              <SectionHeader
                title="流媒体服务"
                description="账号信息已收进详情页，列表只显示可用状态。"
                actions={<Film className="size-5 text-primary" />}
              />
              {streamingGroups.map((group, index) => (
                <CollapsibleGroup
                  key={group.title}
                  title={group.title}
                  subtitle={group.subtitle}
                  defaultOpen={index === 0}
                >
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {group.items.map((sub) => (
                      <ActiveSubscriptionCard key={sub.id} sub={sub} poolMap={poolMap} />
                    ))}
                  </div>
                </CollapsibleGroup>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
