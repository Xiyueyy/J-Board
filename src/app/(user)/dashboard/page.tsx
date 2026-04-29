import type { Metadata } from "next";
import { getActiveSession } from "@/lib/require-auth";
import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { getDashboardData, getDashboardTrafficTrend } from "./dashboard-data";
import {
  getProxyClientIds,
  getProxySubscriptions,
  getStreamingSubscriptions,
  getTrafficOverview,
  getUpcomingExpiries,
} from "./dashboard-calculations";
import { DashboardActions } from "./_components/dashboard-actions";
import { DashboardMetricGrid } from "./_components/dashboard-metric-grid";
import { FirstRunGuide } from "./_components/first-run-guide";
import { MaintenanceNotice } from "./_components/maintenance-notice";
import { ProxyTrafficOverviewCard } from "./_components/proxy-traffic-overview-card";
import { TrafficSection } from "./_components/traffic-section";
import { UpcomingExpiryCard } from "./_components/upcoming-expiry-card";

export const metadata: Metadata = {
  title: "我的概览",
  description: "查看订阅概况、流量趋势与到期提醒。",
};

export default async function UserDashboard() {
  const session = await getActiveSession();
  const userId = session!.user.id;

  const { activeSubs, pendingOrderCount, paidOrderCount, config } =
    await getDashboardData(userId);

  const proxyActive = getProxySubscriptions(activeSubs);
  const streamingActive = getStreamingSubscriptions(activeSubs);
  const trafficOverview = getTrafficOverview(proxyActive);
  const nearestExpiry = activeSubs[0]?.endDate ?? null;
  const clientIds = getProxyClientIds(proxyActive);
  const upcomingExpiries = getUpcomingExpiries(activeSubs);
  const trafficTrend = await getDashboardTrafficTrend(clientIds);
  const dashboardDescription =
    activeSubs.length === 0
      ? "完成首个订阅后这里将显示用量总览。"
      : `${activeSubs.length} 个活跃订阅 · ${pendingOrderCount} 个待支付订单`;

  return (
    <PageShell>
      {config.maintenanceNotice && (
        <MaintenanceNotice message={config.maintenanceNotice} />
      )}

      <PageHeader
        eyebrow="账户概览"
        title={`你好，${session!.user.name || "用户"}`}
        description={dashboardDescription}
        actions={<DashboardActions />}
      />

      {activeSubs.length === 0 && (
        <FirstRunGuide pendingOrderCount={pendingOrderCount} />
      )}

      <DashboardMetricGrid
        activeCount={activeSubs.length}
        proxyCount={proxyActive.length}
        streamingCount={streamingActive.length}
        pendingOrderCount={pendingOrderCount}
        paidOrderCount={paidOrderCount}
        nearestExpiry={nearestExpiry}
        traffic={trafficOverview}
      />

      <section className="grid gap-5 xl:grid-cols-2">
        <ProxyTrafficOverviewCard
          proxyCount={proxyActive.length}
          traffic={trafficOverview}
        />
        <UpcomingExpiryCard items={upcomingExpiries} />
      </section>

      {proxyActive.length > 0 && <TrafficSection trend={trafficTrend} />}
    </PageShell>
  );
}
