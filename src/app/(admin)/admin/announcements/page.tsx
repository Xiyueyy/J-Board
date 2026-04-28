import type { Metadata } from "next";
import { AdminFilterBar } from "@/components/admin/filter-bar";
import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { Pagination } from "@/components/shared/pagination";
import { AnnouncementsTable } from "./_components/announcements-table";
import { CreateAnnouncementButton } from "./announcement-form";
import { getAnnouncements } from "./announcements-data";

export const metadata: Metadata = {
  title: "公告与消息",
  description: "发布全站公告与定向通知。",
};

export default async function AnnouncementsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { announcements, total, users, page, pageSize, filters } = await getAnnouncements(
    await searchParams,
  );

  return (
    <PageShell>
      <PageHeader
        eyebrow="用户支持"
        title="公告与消息"
        actions={<CreateAnnouncementButton users={users} />}
      />

      <AdminFilterBar
        q={filters.q}
        searchPlaceholder="搜索标题或内容"
        selects={[
          {
            name: "audience",
            value: filters.audience,
            options: [
              { label: "全部范围", value: "" },
              { label: "公开", value: "PUBLIC" },
              { label: "全部用户", value: "USERS" },
              { label: "全部管理员", value: "ADMINS" },
              { label: "指定用户", value: "SPECIFIC_USER" },
            ],
          },
          {
            name: "status",
            value: filters.status,
            options: [
              { label: "全部状态", value: "" },
              { label: "启用", value: "active" },
              { label: "停用", value: "inactive" },
            ],
          },
        ]}
      />

      <AnnouncementsTable announcements={announcements} users={users} />
      <Pagination total={total} pageSize={pageSize} page={page} />
    </PageShell>
  );
}
