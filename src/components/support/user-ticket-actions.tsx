"use client";

import { useRouter } from "next/navigation";
import {
  closeSupportTicket,
  deleteSupportTicket,
} from "@/actions/user/support";
import { ConfirmActionButton } from "@/components/shared/confirm-action-button";

export function UserSupportTicketActions({
  ticketId,
  status,
  redirectAfterDelete,
}: {
  ticketId: string;
  status: "OPEN" | "USER_REPLIED" | "ADMIN_REPLIED" | "CLOSED";
  redirectAfterDelete?: string;
}) {
  const router = useRouter();

  return (
    <div className="flex flex-wrap gap-2">
      {status !== "CLOSED" && (
        <ConfirmActionButton
          size="sm"
          variant="outline"
          title="关闭这张工单？"
          description="关闭后，这个问题会进入已处理状态。如果后续还有补充，可以再创建新的工单。"
          confirmLabel="关闭工单"
          successMessage="工单已关闭"
          errorMessage="关闭工单失败"
          onConfirm={() => closeSupportTicket(ticketId)}
          onSuccess={() => router.refresh()}
        >
          关闭工单
        </ConfirmActionButton>
      )}

      <ConfirmActionButton
        size="sm"
        variant="destructive"
        title="删除这张工单？"
        description="工单记录、回复内容和附件会一起删除，此操作无法恢复。"
        confirmLabel="删除工单"
        successMessage="工单已删除"
        errorMessage="删除工单失败"
        onConfirm={() => deleteSupportTicket(ticketId)}
        onSuccess={() => {
          if (redirectAfterDelete) router.push(redirectAfterDelete);
          router.refresh();
        }}
      >
        删除工单
      </ConfirmActionButton>
    </div>
  );
}
