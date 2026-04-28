import type { Metadata } from "next";
import { AdminFilterBar } from "@/components/admin/filter-bar";
import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { Pagination } from "@/components/shared/pagination";
import { ServiceForm } from "./service-form";
import { ServicesTable } from "./_components/services-table";
import { getStreamingServices } from "./services-data";

export const metadata: Metadata = {
  title: "流媒体服务",
  description: "管理共享服务、凭据与可售容量。",
};

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { services, total, page, pageSize, filters } = await getStreamingServices(await searchParams);

  return (
    <PageShell>
      <PageHeader
        eyebrow="商品与订单"
        title="流媒体服务"
        actions={<ServiceForm />}
      />
      <AdminFilterBar
        q={filters.q}
        searchPlaceholder="搜索服务名称或描述"
        selects={[
          {
            name: "status",
            value: filters.status,
            options: [
              { label: "全部状态", value: "" },
              { label: "启用中", value: "active" },
              { label: "已停用", value: "inactive" },
            ],
          },
        ]}
      />
      <ServicesTable services={services} />
      <Pagination total={total} pageSize={pageSize} page={page} />
    </PageShell>
  );
}
