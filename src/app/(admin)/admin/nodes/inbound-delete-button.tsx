"use client";

import { deleteInbound } from "@/actions/admin/nodes";
import { ConfirmActionButton } from "@/components/shared/confirm-action-button";

export function InboundDeleteButton({
  inboundId,
}: {
  inboundId: string;
}) {
  return (
    <ConfirmActionButton
      size="xs"
      variant="ghost"
      className="h-7 px-2 text-destructive hover:text-destructive"
      title="删除这个线路入口？"
      description="这里只会移除本地同步记录，不会删除 3x-ui 面板中的入站。请确认没有套餐仍依赖它。"
      confirmLabel="删除入口"
      successMessage="线路入口已删除"
      errorMessage="删除线路入口失败"
      onConfirm={() => deleteInbound(inboundId)}
    >
      删除
    </ConfirmActionButton>
  );
}
