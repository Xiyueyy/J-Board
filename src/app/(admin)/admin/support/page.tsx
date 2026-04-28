import type { Metadata } from "next";
import { AdminFilterBar } from "@/components/admin/filter-bar";
import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { Pagination } from "@/components/shared/pagination";
import { AdminSupportTable } from "./_components/admin-support-table";
import { getAdminSupportTickets } from "./support-data";

export const metadata: Metadata = {
  title: "工单与售后",
  description: "处理用户工单、售后回复与状态流转。",
};

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tickets, total, page, pageSize, filters } = await getAdminSupportTickets(
    await searchParams,
  );

  return (
    <PageShell>
      <PageHeader
        eyebrow="用户支持"
        title="工单与售后"
      />

      <AdminFilterBar
        q={filters.q}
        searchPlaceholder="搜索标题、分类、用户邮箱"
        selects={[
          {
            name: "status",
            value: filters.status,
            options: [
              { label: "全部状态", value: "" },
              { label: "待处理", value: "OPEN" },
              { label: "用户已回复", value: "USER_REPLIED" },
              { label: "管理员已回复", value: "ADMIN_REPLIED" },
              { label: "已关闭", value: "CLOSED" },
            ],
          },
          {
            name: "priority",
            value: filters.priority,
            options: [
              { label: "全部优先级", value: "" },
              { label: "低", value: "LOW" },
              { label: "普通", value: "NORMAL" },
              { label: "高", value: "HIGH" },
              { label: "紧急", value: "URGENT" },
            ],
          },
        ]}
      />

      <AdminSupportTable tickets={tickets} />
      <Pagination total={total} pageSize={pageSize} page={page} />
    </PageShell>
  );
}
