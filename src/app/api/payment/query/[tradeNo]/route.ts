import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api-response";
import { getPaymentAdapter } from "@/services/payment/factory";
import { handleVerifiedPaymentSuccess } from "@/services/payment/process";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tradeNo: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return jsonError("未登录", { status: 401 });
  }

  const { tradeNo } = await params;
  const order = await prisma.order.findUnique({
    where: { tradeNo },
    select: {
      userId: true,
      status: true,
      paymentMethod: true,
      createdAt: true,
      note: true,
    },
  });

  if (!order || order.userId !== session.user.id) {
    return jsonError("订单不存在", { status: 404 });
  }

  if (order.status === "PAID") {
    return jsonOk({ status: "paid" });
  }

  if (order.status !== "PENDING" || !order.paymentMethod) {
    return jsonOk({ status: order.status.toLowerCase() });
  }

  if (order.note?.startsWith("Provision failed: ")) {
    return jsonOk({
      status: "processing_failed",
      error: order.note.replace(/^Provision failed:\s*/, ""),
    });
  }

  try {
    const adapter = await getPaymentAdapter(order.paymentMethod);
    const result = await adapter.queryOrder(tradeNo, order.createdAt.getTime());

    if (result && result.status === "success") {
      const processed = await handleVerifiedPaymentSuccess(
        tradeNo,
        result.amount,
        result.paymentRef,
      );
      if (processed.finalStatus === "PAID") {
        return jsonOk({ status: "paid" });
      }

      if (processed.errorMessage) {
        return jsonOk({
          status: "processing_failed",
          error: `支付已确认，但开通失败：${processed.errorMessage}`,
        });
      }

      if (processed.finalStatus) {
        return jsonOk({ status: processed.finalStatus.toLowerCase() });
      }
    }
  } catch (error) {
    return jsonError(error, { fallback: "查询支付状态失败" });
  }

  return jsonOk({ status: "pending" });
}
