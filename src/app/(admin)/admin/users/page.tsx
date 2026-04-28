import type { Metadata } from "next";
import { AdminFilterBar } from "@/components/admin/filter-bar";
import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { Pagination } from "@/components/shared/pagination";
import { UserForm } from "./user-form";
import { UsersTable } from "./_components/users-table";
import { getAdminUsers } from "./users-data";

export const metadata: Metadata = {
  title: "用户管理",
  description: "管理用户身份、状态与基础信息。",
};

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { users, total, page, pageSize, filters } = await getAdminUsers(await searchParams);

  return (
    <PageShell>
      <PageHeader
        eyebrow="用户支持"
        title="用户管理"
        actions={<UserForm />}
      />
      <AdminFilterBar
        q={filters.q}
        searchPlaceholder="搜索邮箱、昵称、邀请码、邀请人"
        selects={[
          {
            name: "role",
            value: filters.role,
            options: [
              { label: "全部角色", value: "" },
              { label: "管理员", value: "ADMIN" },
              { label: "普通用户", value: "USER" },
            ],
          },
          {
            name: "status",
            value: filters.status,
            options: [
              { label: "全部状态", value: "" },
              { label: "正常", value: "ACTIVE" },
              { label: "禁用", value: "DISABLED" },
              { label: "封禁", value: "BANNED" },
            ],
          },
        ]}
      />
      <UsersTable users={users} />
      <Pagination total={total} pageSize={pageSize} page={page} />
    </PageShell>
  );
}
