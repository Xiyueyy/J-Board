"use client";

import { updateOrderReview } from "@/actions/admin/orders";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "sonner";

export function OrderReviewActions({
  orderId,
  reviewStatus,
}: {
  orderId: string;
  reviewStatus: "NORMAL" | "FLAGGED" | "RESOLVED";
}) {
  async function handle(status: "FLAGGED" | "RESOLVED" | "NORMAL") {
    const note =
      status === "NORMAL"
        ? ""
        : prompt("请输入异常备注/处理备注（可留空）") ?? "";

    try {
      await updateOrderReview(orderId, status, note);
      toast.success("订单审查状态已更新");
    } catch (error) {
      toast.error(getErrorMessage(error, "更新失败"));
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {reviewStatus !== "FLAGGED" && (
        <Button size="sm" variant="outline" onClick={() => void handle("FLAGGED")}>
          标记异常
        </Button>
      )}
      {reviewStatus !== "RESOLVED" && (
        <Button size="sm" variant="outline" onClick={() => void handle("RESOLVED")}>
          标记解决
        </Button>
      )}
      {reviewStatus !== "NORMAL" && (
        <Button size="sm" variant="ghost" onClick={() => void handle("NORMAL")}>
          恢复正常
        </Button>
      )}
    </div>
  );
}
