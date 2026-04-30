import type { Metadata } from "next";
import { AdminFilterBar } from "@/components/admin/filter-bar";
import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { Pagination } from "@/components/shared/pagination";
import { StatusBadge } from "@/components/shared/status-badge";
import { OnlineUsersTable } from "./_components/online-users-table";
import { getOnlineUsersPageData } from "./online-users-data";

export const metadata: Metadata = {
  title: "在线用户",
  description: "查看用户在线状态、最后连接节点、来源 IP、目标网站与流量用量。",
};

export default async function OnlineUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { users, total, page, pageSize, filters, overview } = await getOnlineUsersPageData(await searchParams);

  return (
    <PageShell>
      <PageHeader
        eyebrow="用户支持"
        title="在线用户"
        description="基于 Agent Xray access log 和 3x-ui 流量同步，聚合显示用户最后连接节点、来源 IP、目标网站和用量。"
        actions={(
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone="success">在线 {overview.onlineUsers}</StatusBadge>
            <StatusBadge tone="info">刚活跃 {overview.recentUsers}</StatusBadge>
            <StatusBadge tone="neutral">活跃订阅用户 {overview.activeUsers}</StatusBadge>
          </div>
        )}
      />

      <AdminFilterBar
        q={filters.q}
        searchPlaceholder="搜索邮箱、昵称"
        selects={[
          {
            name: "online",
            value: filters.online,
            options: [
              { label: "全部在线状态", value: "" },
              { label: "在线", value: "online" },
              { label: "刚活跃", value: "recent" },
              { label: "离线", value: "idle" },
              { label: "有活跃订阅", value: "active" },
              { label: "无活跃订阅", value: "inactive" },
            ],
          },
          {
            name: "status",
            value: filters.status,
            options: [
              { label: "全部账号状态", value: "" },
              { label: "正常", value: "ACTIVE" },
              { label: "待邮箱验证", value: "PENDING_EMAIL" },
              { label: "禁用", value: "DISABLED" },
              { label: "封禁", value: "BANNED" },
            ],
          },
        ]}
      />

      <OnlineUsersTable users={users} />
      <Pagination total={total} pageSize={pageSize} page={page} />
    </PageShell>
  );
}
