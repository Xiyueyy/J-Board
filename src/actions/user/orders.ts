"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/require-auth";

async function findOwnPendingOrder(orderId: string, userId: string) {
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      userId,
    },
    select: { id: true, status: true },
  });

  if (!order) {
    throw new Error("订单不存在");
  }
  if (order.status !== "PENDING") {
    throw new Error("这笔订单已经不在待支付状态");
  }

  return order;
}

export async function cancelOwnPendingOrder(orderId: string) {
  const session = await requireAuth();
  await findOwnPendingOrder(orderId, session.user.id);

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: {
        status: "CANCELLED",
        paymentMethod: null,
        paymentRef: null,
        paymentUrl: null,
        tradeNo: null,
        expireAt: null,
      },
    });

    await tx.couponGrant.updateMany({
      where: { usedOrderId: orderId },
      data: { usedOrderId: null, usedAt: null },
    });
  });

  revalidatePath("/orders");
  revalidatePath("/store");
  revalidatePath(`/pay/${orderId}`);
}

export async function resetOwnPendingPaymentChoice(orderId: string) {
  const session = await requireAuth();
  await findOwnPendingOrder(orderId, session.user.id);

  await prisma.order.update({
    where: { id: orderId },
    data: {
      paymentMethod: null,
      paymentRef: null,
      paymentUrl: null,
      tradeNo: null,
      expireAt: null,
    },
  });

  revalidatePath("/orders");
  revalidatePath(`/pay/${orderId}`);
}
