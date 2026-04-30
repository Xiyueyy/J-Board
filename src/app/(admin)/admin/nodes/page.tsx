import type { Metadata } from "next";
import { AdminFilterBar } from "@/components/admin/filter-bar";
import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { Pagination } from "@/components/shared/pagination";
import { NodeForm } from "./node-form";
import { NodesAutoRefresh } from "./_components/nodes-auto-refresh";
import { NodeCardList } from "./_components/node-card-list";
import { getNodeServers } from "./nodes-data";

export const metadata: Metadata = {
  title: "节点管理",
  description: "维护节点面板连接与可售入站配置。",
};

export default async function NodesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { nodes, total, page, pageSize, filters, siteUrl } = await getNodeServers(await searchParams);

  return (
    <PageShell>
      <PageHeader
        eyebrow="基础设施"
        title="节点管理"
        actions={(
          <div className="flex flex-wrap gap-2">
            <NodesAutoRefresh intervalSeconds={3} />
            <NodeForm />
          </div>
        )}
      />
      <AdminFilterBar
        q={filters.q}
        searchPlaceholder="搜索节点名、主机或面板地址"
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
      <NodeCardList nodes={nodes} siteUrl={siteUrl} />
      <Pagination total={total} pageSize={pageSize} page={page} />
    </PageShell>
  );
}
