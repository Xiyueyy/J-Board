"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-auth";
import { revalidatePath } from "next/cache";
import { confirmPendingOrder } from "@/services/payment/process";
import { actorFromSession, recordAuditLog } from "@/services/audit";

export async function confirmOrder(orderId: string) {
  const session = await requireAdmin();
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    select: { status: true, id: true, paymentMethod: true },
  });
  if (order.status !== "PENDING") {
    throw new Error("订单状态不正确");
  }

  const result = await confirmPendingOrder(
    orderId,
    order.paymentMethod === "manual_qr" ? "manual_qr:admin_confirmed" : undefined,
  );
  if (result.finalStatus !== "PAID") {
    throw new Error(result.errorMessage ?? "订单处理失败");
  }
  await recordAuditLog({
    actor: actorFromSession(session),
    action: "order.confirm",
    targetType: "Order",
    targetId: order.id,
    targetLabel: order.id,
    message: `确认订单 ${order.id}`,
  });

  revalidatePath("/admin/orders");
}

export async function cancelOrder(orderId: string) {
  const session = await requireAdmin();
  await prisma.order.update({ where: { id: orderId }, data: { status: "CANCELLED" } });
  await recordAuditLog({
    actor: actorFromSession(session),
    action: "order.cancel",
    targetType: "Order",
    targetId: orderId,
    targetLabel: orderId,
    message: `取消订单 ${orderId}`,
  });
  revalidatePath("/admin/orders");
}

export async function updateOrderReview(
  orderId: string,
  reviewStatus: "NORMAL" | "FLAGGED" | "RESOLVED",
  reviewNote?: string,
) {
  const session = await requireAdmin();
  const order = await prisma.order.update({
    where: { id: orderId },
    data: {
      reviewStatus,
      reviewNote: reviewNote?.trim() || null,
    },
  });

  await recordAuditLog({
    actor: actorFromSession(session),
    action: "order.review",
    targetType: "Order",
    targetId: order.id,
    targetLabel: order.id,
    message: `将订单 ${order.id} 标记为 ${reviewStatus}`,
  });

  revalidatePath("/admin/orders");
}

export async function batchOrderOperation(formData: FormData) {
  const action = String(formData.get("action") || "");
  const orderIds = formData.getAll("orderIds").map(String).filter(Boolean);

  if (orderIds.length === 0) {
    throw new Error("请至少选择一个订单");
  }

  for (const orderId of orderIds) {
    if (action === "confirm") {
      await confirmOrder(orderId);
    } else if (action === "cancel") {
      await cancelOrder(orderId);
    } else {
      throw new Error("不支持的批量操作");
    }
  }
}
