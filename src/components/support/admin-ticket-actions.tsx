"use client";

import { useRouter } from "next/navigation";
import { deleteSupportTicketAsAdmin } from "@/actions/admin/support";
import { ConfirmActionButton } from "@/components/shared/confirm-action-button";

export function AdminSupportTicketActions({
  ticketId,
  redirectAfterDelete,
}: {
  ticketId: string;
  redirectAfterDelete?: string;
}) {
  const router = useRouter();

  return (
    <ConfirmActionButton
      size="sm"
      variant="destructive"
      title="删除这张工单？"
      description="用户对话、附件和关联通知会立即删除，此操作无法恢复。"
      confirmLabel="删除工单"
      successMessage="工单已删除"
      errorMessage="删除工单失败"
      onConfirm={() => deleteSupportTicketAsAdmin(ticketId)}
      onSuccess={() => {
        if (redirectAfterDelete) router.push(redirectAfterDelete);
        router.refresh();
      }}
    >
      删除工单
    </ConfirmActionButton>
  );
}
