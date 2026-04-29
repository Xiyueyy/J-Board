import type { Metadata } from "next";
import { getActiveSession } from "@/lib/require-auth";
import { Pagination } from "@/components/shared/pagination";
import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { UserOrdersTable } from "./_components/user-orders-table";
import { getUserOrders } from "./orders-data";

export const metadata: Metadata = {
  title: "我的订单",
  description: "查看新购、续费和增流量订单记录。",
};

export default async function UserOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getActiveSession();
  const { orders, total, page, pageSize } = await getUserOrders({
    userId: session!.user.id,
    searchParams: await searchParams,
  });

  return (
    <PageShell>
      <PageHeader
        eyebrow="订单记录"
        title="我的订单"
      />
      <UserOrdersTable orders={orders} />
      <Pagination total={total} pageSize={pageSize} page={page} />
    </PageShell>
  );
}
