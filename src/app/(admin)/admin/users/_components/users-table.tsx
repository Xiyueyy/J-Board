import { batchUpdateUserStatus } from "@/actions/admin/users";
import { BatchActionBar, BatchActionButton } from "@/components/admin/batch-action-bar";
import { DataTableShell } from "@/components/admin/data-table-shell";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeadCell,
  DataTableHeaderRow,
  DataTableRow,
} from "@/components/shared/data-table";
import { UserRoleBadge, UserStatusBadge } from "@/components/shared/domain-badges";
import { formatDateShort } from "@/lib/utils";
import { UserActions } from "../user-actions";
import type { AdminUserRow } from "../users-data";

interface UsersTableProps {
  users: AdminUserRow[];
}

export function UsersTable({ users }: UsersTableProps) {
  return (
    <DataTableShell
      isEmpty={users.length === 0}
      emptyTitle="暂无用户"
      emptyDescription="创建用户或等待新用户注册后，会显示在这里。"
      toolbar={
        <BatchActionBar
          id="user-batch-form"
          action={batchUpdateUserStatus}
          className="rounded-none bg-transparent"
        >
          <BatchActionButton name="status" value="ACTIVE">
            批量启用
          </BatchActionButton>
          <BatchActionButton name="status" value="DISABLED">
            批量禁用
          </BatchActionButton>
          <BatchActionButton name="status" value="BANNED" destructive>
            批量封禁
          </BatchActionButton>
        </BatchActionBar>
      }
    >
      <DataTable aria-label="用户列表" className="min-w-[980px]">
        <DataTableHead>
          <DataTableHeaderRow>
            <DataTableHeadCell>选择</DataTableHeadCell>
            <DataTableHeadCell>邮箱</DataTableHeadCell>
            <DataTableHeadCell>昵称</DataTableHeadCell>
            <DataTableHeadCell>邀请码</DataTableHeadCell>
            <DataTableHeadCell>角色</DataTableHeadCell>
            <DataTableHeadCell>状态</DataTableHeadCell>
            <DataTableHeadCell>订阅数</DataTableHeadCell>
            <DataTableHeadCell>邀请数据</DataTableHeadCell>
            <DataTableHeadCell>注册时间</DataTableHeadCell>
            <DataTableHeadCell className="text-right">操作</DataTableHeadCell>
          </DataTableHeaderRow>
        </DataTableHead>
        <DataTableBody>
          {users.map((user) => (
            <DataTableRow key={user.id}>
              <DataTableCell>
                <input
                  form="user-batch-form"
                  type="checkbox"
                  name="userIds"
                  value={user.id}
                  aria-label={`选择用户 ${user.email}`}
                />
              </DataTableCell>
              <DataTableCell className="max-w-56 whitespace-normal break-all font-medium">{user.email}</DataTableCell>
              <DataTableCell className="max-w-44 whitespace-normal break-words text-muted-foreground">{user.name || "—"}</DataTableCell>
              <DataTableCell className="max-w-40 whitespace-normal break-all text-muted-foreground">{user.inviteCode || "—"}</DataTableCell>
              <DataTableCell>
                <UserRoleBadge role={user.role} />
              </DataTableCell>
              <DataTableCell>
                <UserStatusBadge status={user.status} />
              </DataTableCell>
              <DataTableCell className="tabular-nums">{user._count.subscriptions}</DataTableCell>
              <DataTableCell className="text-xs text-muted-foreground">
                <div className="space-y-1">
                  <p>邀请了 {user._count.invitedUsers} 人</p>
                  <p>邀请人：{user.invitedBy?.email ?? "—"}</p>
                </div>
              </DataTableCell>
              <DataTableCell className="whitespace-nowrap text-muted-foreground">
                {formatDateShort(user.createdAt)}
              </DataTableCell>
              <DataTableCell>
                <div className="flex justify-end">
                  <UserActions user={user} />
                </div>
              </DataTableCell>
            </DataTableRow>
          ))}
        </DataTableBody>
      </DataTable>
    </DataTableShell>
  );
}
