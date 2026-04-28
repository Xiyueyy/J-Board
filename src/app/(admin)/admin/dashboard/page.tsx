import type { Metadata } from "next";
import { MetricCard } from "@/components/shared/metric-card";
import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { getAdminDashboardStats, getRecentAdminActivity } from "./dashboard-data";
import { RecentSection } from "./_components/recent-section";

export const metadata: Metadata = {
  title: "仪表盘",
  description: "查看后台核心指标与近期关键活动。",
};

export default async function AdminDashboard() {
  const [stats, recentActivity] = await Promise.all([
    getAdminDashboardStats(),
    getRecentAdminActivity(),
  ]);

  return (
    <PageShell>
      <PageHeader
        eyebrow="管理概览"
        title="仪表盘"
      />
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-5">
        {stats.map((stat) => (
          <MetricCard key={stat.label} label={stat.label} value={stat.value} />
        ))}
      </div>

      <RecentSection
        recentOrders={recentActivity.recentOrders}
        recentUsers={recentActivity.recentUsers}
      />
    </PageShell>
  );
}
