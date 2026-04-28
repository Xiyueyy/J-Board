"use client";

import { cancelOwnPendingOrder } from "@/actions/user/orders";
import { ConfirmActionButton } from "@/components/shared/confirm-action-button";

export function UserOrderActions({
  orderId,
  status,
}: {
  orderId: string;
  status: "PENDING" | "PAID" | "CANCELLED" | "REFUNDED";
}) {
  if (status !== "PENDING") {
    return null;
  }

  return (
    <ConfirmActionButton
      size="sm"
      variant="ghost"
      className="text-destructive hover:text-destructive"
      title="取消这笔订单？"
      description="取消后会释放当前保留的名额，你可以重新选择套餐或支付方式。"
      confirmLabel="取消订单"
      successMessage="订单已取消"
      errorMessage="取消订单失败"
      onConfirm={() => cancelOwnPendingOrder(orderId)}
    >
      取消订单
    </ConfirmActionButton>
  );
}
