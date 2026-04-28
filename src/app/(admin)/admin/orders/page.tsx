import type { Metadata } from "next";
import { AdminFilterBar } from "@/components/admin/filter-bar";
import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { Pagination } from "@/components/shared/pagination";
import { OrdersTable } from "./_components/orders-table";
import { getAdminOrders } from "./orders-data";

export const metadata: Metadata = {
  title: "订单管理",
  description: "跟踪订单状态、审查结果与支付记录。",
};

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { orders, total, page, pageSize, filters } = await getAdminOrders(await searchParams);

  return (
    <PageShell>
      <PageHeader
        eyebrow="商品与订单"
        title="订单管理"
      />
      <AdminFilterBar
        q={filters.q}
        searchPlaceholder="搜索邮箱、套餐、交易号"
        selects={[
          {
            name: "status",
            value: filters.status,
            options: [
              { label: "全部状态", value: "" },
              { label: "待确认", value: "PENDING" },
              { label: "已支付", value: "PAID" },
              { label: "已取消", value: "CANCELLED" },
              { label: "已退款", value: "REFUNDED" },
            ],
          },
          {
            name: "kind",
            value: filters.kind,
            options: [
              { label: "全部类型", value: "" },
              { label: "新购", value: "NEW_PURCHASE" },
              { label: "续费", value: "RENEWAL" },
              { label: "增流量", value: "TRAFFIC_TOPUP" },
            ],
          },
          {
            name: "reviewStatus",
            value: filters.reviewStatus,
            options: [
              { label: "全部审查", value: "" },
              { label: "正常", value: "NORMAL" },
              { label: "异常", value: "FLAGGED" },
              { label: "已解决", value: "RESOLVED" },
            ],
          },
        ]}
      />
      <OrdersTable orders={orders} />
      <Pagination total={total} pageSize={pageSize} page={page} />
    </PageShell>
  );
}
