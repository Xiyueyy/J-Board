import type { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getErrorMessage } from "@/lib/errors";
import { createNotification } from "@/services/notifications";
import { provisionSubscriptionWithDb } from "@/services/provision";
import { recordTaskFailure } from "@/services/task-center";
import { issueInviteRewardForOrder } from "@/services/invite-rewards";

export interface PaymentProcessResult {
  processed: boolean;
  finalStatus: OrderStatus | null;
  errorMessage?: string;
}

interface PaymentProcessTxnResult extends PaymentProcessResult {
  affectedNodeIds: string[];
}

const PAYMENT_PROVISION_TRANSACTION_OPTIONS = {
  maxWait: 10_000,
  timeout: 60_000,
} as const;

async function processOrderPaymentById(
  orderId: string,
  paymentRef?: string,
): Promise<PaymentProcessResult> {
  try {
    const result = await prisma.$transaction<PaymentProcessTxnResult>(async (tx) => {
      const claimed = await tx.order.updateMany({
        where: {
          id: orderId,
          status: "PENDING",
        },
        data: {
          status: "PAID",
          note: null,
          ...(paymentRef !== undefined ? { paymentRef } : {}),
        },
      });

      if (claimed.count === 0) {
        const current = await tx.order.findUnique({
          where: { id: orderId },
          select: { status: true },
        });

        return {
          processed: false,
          finalStatus: current?.status ?? null,
          affectedNodeIds: [],
        };
      }

      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { plan: true, user: true },
      });

      if (!order || order.status !== "PAID") {
        return { processed: false, finalStatus: order?.status ?? null, affectedNodeIds: [] };
      }

      const affectedNodeIds = await provisionSubscriptionWithDb(order, tx);
      if (order.kind === "NEW_PURCHASE") {
        await issueInviteRewardForOrder({ ...order, status: "PAID" }, tx);
      }
      return { processed: true, finalStatus: "PAID", affectedNodeIds };
    }, PAYMENT_PROVISION_TRANSACTION_OPTIONS);

    return {
      processed: result.processed,
      finalStatus: result.finalStatus,
      errorMessage: result.errorMessage,
    };
  } catch (error) {
    const message = getErrorMessage(error, "开通失败");
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        userId: true,
        plan: {
          select: {
            name: true,
          },
        },
      },
    });

    if (order) {
      await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: "PENDING",
            note: `Provision failed: ${message}`,
          },
        });
        await createNotification(
          {
            userId: order.userId,
            type: "ORDER",
            level: "ERROR",
            title: "支付已确认，但开通失败",
            body: `${order.plan.name} 支付成功，但开通时发生错误：${message}`,
            link: `/pay/${order.id}`,
            dedupeKey: `provision-failed:${order.id}`,
          },
          tx,
        );
        await recordTaskFailure(
          {
            kind: "ORDER_PROVISION_RETRY",
            title: `订单 ${order.id} 开通失败待重试`,
            targetType: "Order",
            targetId: order.id,
            payload: {
              orderId: order.id,
            },
            retryable: true,
            errorMessage: message,
          },
          tx,
        );
      });
    }

    return {
      processed: false,
      finalStatus: "PENDING",
      errorMessage: message,
    };
  }
}

export async function handleVerifiedPaymentSuccess(
  tradeNo: string,
  paidAmount: number,
  paymentRef?: string,
) {
  if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
    return { processed: false, finalStatus: null } satisfies PaymentProcessResult;
  }

  const order = await prisma.order.findUnique({
    where: { tradeNo },
    select: { id: true, amount: true },
  });

  if (!order) {
    return { processed: false, finalStatus: null } satisfies PaymentProcessResult;
  }

  const expectedAmount = Number(order.amount);
  if (!Number.isFinite(expectedAmount) || Math.abs(expectedAmount - paidAmount) > 0.01) {
    return {
      processed: false,
      finalStatus: null,
      errorMessage: "支付金额与订单金额不一致",
    } satisfies PaymentProcessResult;
  }

  return processOrderPaymentById(order.id, paymentRef);
}

export async function confirmPendingOrder(orderId: string) {
  return processOrderPaymentById(orderId);
}
