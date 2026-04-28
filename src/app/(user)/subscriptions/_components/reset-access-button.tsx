"use client";

import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { rotateSubscriptionAccess } from "@/actions/user/subscription-security";
import { ConfirmActionButton } from "@/components/shared/confirm-action-button";

export function ResetAccessButton({ subscriptionId }: { subscriptionId: string }) {
  const router = useRouter();

  return (
    <ConfirmActionButton
      size="sm"
      variant="outline"
      className="flex-1 sm:flex-none"
      title="重置订阅访问？"
      description="我们会为这条订阅生成新的访问凭据。旧链接会失效，请在客户端重新导入。"
      confirmLabel="重置访问"
      successMessage="订阅访问已重置"
      errorMessage="重置失败"
      onConfirm={() => rotateSubscriptionAccess(subscriptionId)}
      onSuccess={() => router.refresh()}
    >
      <ShieldCheck className="size-3.5" />
      重置访问
    </ConfirmActionButton>
  );
}
