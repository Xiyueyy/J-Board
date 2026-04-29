import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PageHeader, PageShell, SectionHeader } from "@/components/shared/page-shell";
import { SubscriptionDetailCards } from "@/components/subscriptions/subscription-detail-cards";
import { SubscriptionTimelineSection } from "@/components/subscriptions/subscription-timeline-section";
import { TrafficLogs } from "./_components/traffic-logs";
import { getSubscriptionBaseUrl } from "@/services/site-url";
import { ProxySubscriptionDetails } from "../_components/proxy-subscription-details";
import { StreamingCredentialCard } from "../streaming-credential-card";
import { getUserSubscriptionDetail } from "./subscription-detail-data";

export const metadata: Metadata = {
  title: "订阅详情",
  description: "查看订阅详情、流量记录与生命周期事件。",
};

export default async function UserSubscriptionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  const { id } = await params;
  const requestHeaders = await headers();
  const [data, baseUrl] = await Promise.all([
    getUserSubscriptionDetail({
      subscriptionId: id,
      userId: session!.user.id,
    }),
    getSubscriptionBaseUrl({ headers: requestHeaders }),
  ]);

  if (!data) {
    notFound();
  }

  const { subscription, auditLogs, trafficLogs } = data;

  return (
    <PageShell>
      <PageHeader
        eyebrow="订阅详情"
        title={subscription.plan.name}
      />
      <SubscriptionDetailCards subscription={subscription} />
      {subscription.plan.type === "PROXY" && (
        <section className="surface-card space-y-4 rounded-xl p-5">
          <SectionHeader
            title="导入与二维码"
            description="单节点链接保留在详情页；日常使用建议导入订阅页的总订阅链接。"
          />
          <ProxySubscriptionDetails sub={subscription} baseUrl={baseUrl} />
        </section>
      )}
      {subscription.plan.type === "STREAMING" && subscription.streamingSlot && (
        <section className="surface-card space-y-4 rounded-xl p-5">
          <SectionHeader
            title="账号凭据"
            description="只在需要时展开共享账号信息。"
          />
          <StreamingCredentialCard subscriptionId={subscription.id} />
        </section>
      )}
      <SubscriptionTimelineSection logs={auditLogs} />
      {subscription.nodeClient && <TrafficLogs logs={trafficLogs} />}
    </PageShell>
  );
}
