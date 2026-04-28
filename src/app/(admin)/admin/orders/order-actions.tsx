"use client";

import { getErrorMessage } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { confirmOrder, cancelOrder } from "@/actions/admin/orders";
import { toast } from "sonner";
type AdminOrderActionStatus = "PENDING" | "PAID" | "CANCELLED" | "REFUNDED";

export function OrderActions({
  orderId,
  status,
}: {
  orderId: string;
  status: AdminOrderActionStatus;
}) {
  if (status !== "PENDING") return null;

  return (
    <div className="flex gap-1">
      <Button
        size="sm"
        onClick={async () => {
          try {
            await confirmOrder(orderId);
            toast.success("订单已确认并已处理");
          } catch (error) {
            toast.error(getErrorMessage(error, "确认失败"));
          }
        }}
      >
        确认
      </Button>
      <Button
        size="sm"
        variant="destructive"
        onClick={async () => {
          try {
            await cancelOrder(orderId);
            toast.success("已取消");
          } catch (error) {
            toast.error(getErrorMessage(error, "取消失败"));
          }
        }}
      >
        取消
      </Button>
    </div>
  );
}
