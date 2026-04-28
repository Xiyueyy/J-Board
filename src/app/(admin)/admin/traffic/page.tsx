import type { Metadata } from "next";
import { AdminFilterBar } from "@/components/admin/filter-bar";
import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { Pagination } from "@/components/shared/pagination";
import { TrafficSyncButton } from "./sync-button";
import { TrafficOverviewCards } from "./_components/traffic-overview-cards";
import { TrendSection } from "./_components/trend-section";
import { TrafficClientsTable } from "./_components/traffic-clients-table";
import { getSiteTrafficTrend, getTrafficClients, getTrafficOverview } from "./traffic-data";

export const metadata: Metadata = {
  title: "流量监控",
  description: "查看客户端流量并执行同步任务。",
};

export default async function TrafficPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const [{ clients, total, page, pageSize, filters }, trend, overview] = await Promise.all([
    getTrafficClients(resolvedSearchParams),
    getSiteTrafficTrend(),
    getTrafficOverview(),
  ]);

  return (
    <PageShell>
      <PageHeader
        eyebrow="基础设施"
        title="流量监控"
        actions={<TrafficSyncButton />}
      />
      <AdminFilterBar
        q={filters.q}
        searchPlaceholder="搜索用户邮箱、客户端邮箱、节点名"
        selects={[
          {
            name: "status",
            value: filters.status,
            options: [
              { label: "全部状态", value: "" },
              { label: "启用", value: "enabled" },
              { label: "禁用", value: "disabled" },
            ],
          },
          {
            name: "protocol",
            value: filters.protocol,
            options: [
              { label: "全部协议", value: "" },
              { label: "VMESS", value: "VMESS" },
              { label: "VLESS", value: "VLESS" },
              { label: "TROJAN", value: "TROJAN" },
              { label: "SHADOWSOCKS", value: "SHADOWSOCKS" },
              { label: "HYSTERIA2", value: "HYSTERIA2" },
            ],
          },
        ]}
      />
      <TrafficOverviewCards overview={overview} />
      <TrendSection trend={trend} />
      <TrafficClientsTable clients={clients} />
      <Pagination total={total} pageSize={pageSize} page={page} />
    </PageShell>
  );
}
