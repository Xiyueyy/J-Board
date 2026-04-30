import type { Metadata } from "next";
import { AdminFilterBar } from "@/components/admin/filter-bar";
import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { Pagination } from "@/components/shared/pagination";
import { PlanForm } from "./plan-form";
import { PlansList } from "./_components/plans-list";
import { getAdminPlans } from "./plans-data";

export const metadata: Metadata = {
  title: "套餐管理",
  description: "管理代理与流媒体套餐配置及上架状态。",
};

export default async function PlansPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const {
    plans,
    total,
    page,
    pageSize,
    filters,
    activeCountMap,
    serviceOptions,
    bundleCandidates,
  } = await getAdminPlans(await searchParams);

  return (
    <PageShell>
      <PageHeader
        eyebrow="商品与订单"
        title="套餐管理"
        actions={<PlanForm services={serviceOptions} bundleCandidates={bundleCandidates} />}
      />
      <AdminFilterBar
        q={filters.q}
        searchPlaceholder="搜索套餐名或描述"
        selects={[
          {
            name: "type",
            value: filters.type,
            options: [
              { label: "全部类型", value: "" },
              { label: "代理套餐", value: "PROXY" },
              { label: "流媒体套餐", value: "STREAMING" },
              { label: "聚合套餐", value: "BUNDLE" },
            ],
          },
          {
            name: "status",
            value: filters.status,
            options: [
              { label: "全部状态", value: "" },
              { label: "上架中", value: "active" },
              { label: "已下架", value: "inactive" },
            ],
          },
        ]}
      />
      <PlansList
        plans={plans}
        activeCountMap={activeCountMap}
        services={serviceOptions}
        bundleCandidates={bundleCandidates}
      />
      <Pagination total={total} pageSize={pageSize} page={page} />
    </PageShell>
  );
}
