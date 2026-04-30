import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/require-auth";
import { jsonError, jsonOk } from "@/lib/api-response";
import { confirmPendingOrder } from "@/services/payment/process";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const session = await getActiveSession();
  if (!session) {
    return jsonError("未登录", { status: 401 });
  }

  const { orderId } = await params;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      userId: true,
      status: true,
      paymentMethod: true,
      tradeNo: true,
      paymentUrl: true,
      expireAt: true,
      note: true,
      reviewStatus: true,
      reviewNote: true,
      amount: true,
    },
  });

  if (!order || order.userId !== session.user.id) {
    return jsonError("订单不存在", { status: 404 });
  }

  let snapshot = order;
  if (order.status === "PENDING" && Number(order.amount) <= 0) {
    await confirmPendingOrder(order.id);
    snapshot = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      select: {
        id: true,
        userId: true,
        status: true,
        paymentMethod: true,
        tradeNo: true,
        paymentUrl: true,
        expireAt: true,
        note: true,
        reviewStatus: true,
        reviewNote: true,
        amount: true,
      },
    });
  }

  return jsonOk({
    orderId: snapshot.id,
    status: snapshot.status,
    paymentMethod: snapshot.paymentMethod,
    tradeNo: snapshot.tradeNo,
    paymentUrl: snapshot.paymentUrl,
    expireAt: snapshot.expireAt?.toISOString() ?? null,
    note: snapshot.note,
    reviewStatus: snapshot.reviewStatus,
    reviewNote: snapshot.reviewNote,
  });
}
