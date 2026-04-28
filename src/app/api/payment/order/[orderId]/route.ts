import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api-response";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const session = await getServerSession(authOptions);
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
    },
  });

  if (!order || order.userId !== session.user.id) {
    return jsonError("订单不存在", { status: 404 });
  }

  return jsonOk({
    orderId: order.id,
    status: order.status,
    paymentMethod: order.paymentMethod,
    tradeNo: order.tradeNo,
    paymentUrl: order.paymentUrl,
    expireAt: order.expireAt?.toISOString() ?? null,
    note: order.note,
  });
}
