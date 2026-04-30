import type { Metadata } from "next";
import { AdminFilterBar } from "@/components/admin/filter-bar";
import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { StatusBadge } from "@/components/shared/status-badge";
import { NodesAutoRefresh } from "../nodes/_components/nodes-auto-refresh";
import { NodeRealtimeBoard } from "./_components/node-realtime-board";
import { getNodeRealtimePageData } from "./realtime-data";

export const metadata: Metadata = {
  title: "节点实时监控",
  description: "查看节点整机上传下载速度和 3x-ui 在线用户。",
};

export default async function NodeRealtimePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { nodes, filters, overview } = await getNodeRealtimePageData(await searchParams);

  return (
    <PageShell>
      <PageHeader
        eyebrow="基础设施"
        title="节点实时监控"
        description="集中显示各节点整机上传/下载速度、在线用户、在线设备、来源 IP 和最近目标。"
        actions={(
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone="neutral">节点 {overview.totalNodes}</StatusBadge>
            <StatusBadge tone="success">上报中 {overview.reportingNodes}</StatusBadge>
            <StatusBadge tone="info">在线用户 {overview.onlineUsers}</StatusBadge>
            <StatusBadge tone="warning">在线设备 {overview.onlineDevices}</StatusBadge>
            <NodesAutoRefresh intervalSeconds={3} />
          </div>
        )}
      />
      <AdminFilterBar
        q={filters.q}
        searchPlaceholder="搜索节点名或面板地址"
        selects={[
          {
            name: "status",
            value: filters.status,
            options: [
              { label: "全部状态", value: "" },
              { label: "active", value: "active" },
              { label: "inactive", value: "inactive" },
            ],
          },
        ]}
      />
      <NodeRealtimeBoard nodes={nodes} />
    </PageShell>
  );
}
