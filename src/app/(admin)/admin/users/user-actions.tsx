"use client";

import { Button } from "@/components/ui/button";
import { ConfirmActionButton } from "@/components/shared/confirm-action-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { updateUserStatus, deleteUser } from "@/actions/admin/users";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "sonner";
import type { User } from "@prisma/client";
import { UserForm } from "./user-form";

export function UserActions({ user }: { user: User }) {
  return (
    <div className="flex items-center gap-2">
      <UserForm user={user} triggerLabel="编辑" triggerVariant="outline" />
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>...</DropdownMenuTrigger>
        <DropdownMenuContent>
          {user.status !== "ACTIVE" && (
            <DropdownMenuItem onClick={async () => {
              try {
                await updateUserStatus(user.id, "ACTIVE");
                toast.success("已启用");
              } catch (error) {
                toast.error(getErrorMessage(error, "启用失败"));
              }
            }}>
              启用
            </DropdownMenuItem>
          )}
          {user.status !== "DISABLED" && (
            <DropdownMenuItem onClick={async () => {
              try {
                await updateUserStatus(user.id, "DISABLED");
                toast.success("已禁用");
              } catch (error) {
                toast.error(getErrorMessage(error, "禁用失败"));
              }
            }}>
              禁用
            </DropdownMenuItem>
          )}
          {user.status !== "BANNED" && (
            <DropdownMenuItem onClick={async () => {
              try {
                await updateUserStatus(user.id, "BANNED");
                toast.success("已封禁");
              } catch (error) {
                toast.error(getErrorMessage(error, "封禁失败"));
              }
            }}>
              封禁
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmActionButton
        size="sm"
        variant="destructive"
        title="强制删除这个用户？"
        description="将同步删除该用户在节点面板中的客户端，并永久清理名下订单、订阅、工单、通知、访问日志等数据。此操作不可恢复。"
        confirmLabel="强制删除"
        successMessage="用户已删除"
        errorMessage="删除失败"
        onConfirm={() => deleteUser(user.id)}
      >
        删除
      </ConfirmActionButton>
    </div>
  );
}
