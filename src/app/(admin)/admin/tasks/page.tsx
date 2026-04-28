import type { Metadata } from "next";
import { AdminFilterBar } from "@/components/admin/filter-bar";
import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { Pagination } from "@/components/shared/pagination";
import { TaskLaunchPanel } from "./_components/task-launch-panel";
import { TaskRunsTable } from "./_components/task-runs-table";
import { getAdminTaskRuns } from "./tasks-data";

export const metadata: Metadata = {
  title: "任务中心",
  description: "执行系统任务并跟踪任务执行历史。",
};

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tasks, total, page, pageSize, filters } = await getAdminTaskRuns(await searchParams);

  return (
    <PageShell>
      <PageHeader
        eyebrow="系统"
        title="任务中心"
      />
      <TaskLaunchPanel />
      <AdminFilterBar
        q={filters.q}
        searchPlaceholder="搜索任务标题、错误信息、目标类型"
        selects={[
          {
            name: "kind",
            value: filters.kind,
            options: [
              { label: "全部类型", value: "" },
              { label: "提醒派发", value: "REMINDER_DISPATCH" },
              { label: "订单重试", value: "ORDER_PROVISION_RETRY" },
            ],
          },
          {
            name: "status",
            value: filters.status,
            options: [
              { label: "全部状态", value: "" },
              { label: "待执行", value: "PENDING" },
              { label: "运行中", value: "RUNNING" },
              { label: "成功", value: "SUCCESS" },
              { label: "失败", value: "FAILED" },
            ],
          },
        ]}
      />
      <TaskRunsTable tasks={tasks} />
      <Pagination total={total} pageSize={pageSize} page={page} />
    </PageShell>
  );
}
