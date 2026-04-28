import type { Metadata } from "next";
import { AdminFilterBar } from "@/components/admin/filter-bar";
import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { Pagination } from "@/components/shared/pagination";
import { SubscriptionsTable } from "./_components/subscriptions-table";
import { getAdminSubscriptions } from "./subscriptions-data";

export const metadata: Metadata = {
  title: "订阅管理",
  description: "管理订阅状态、客户端绑定与流媒体槽位。",
};

export default async function AdminSubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { subscriptions, total, page, pageSize, filters, streamingServices } =
    await getAdminSubscriptions(await searchParams);

  return (
    <PageShell>
      <PageHeader
        eyebrow="商品与订单"
        title="订阅管理"
      />

      <AdminFilterBar
        q={filters.q}
        searchPlaceholder="搜索用户邮箱、昵称、套餐名"
        selects={[
          {
            name: "status",
            value: filters.status,
            options: [
              { label: "全部状态", value: "" },
              { label: "活跃", value: "ACTIVE" },
              { label: "暂停", value: "SUSPENDED" },
              { label: "过期", value: "EXPIRED" },
              { label: "取消", value: "CANCELLED" },
            ],
          },
          {
            name: "type",
            value: filters.type,
            options: [
              { label: "全部类型", value: "" },
              { label: "代理", value: "PROXY" },
              { label: "流媒体", value: "STREAMING" },
            ],
          },
        ]}
      />

      <SubscriptionsTable subscriptions={subscriptions} streamingServices={streamingServices} />
      <Pagination total={total} pageSize={pageSize} page={page} />
    </PageShell>
  );
}
