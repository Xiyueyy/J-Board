import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/require-auth";
import { jsonError, jsonOk } from "@/lib/api-response";
import { rateLimit } from "@/lib/rate-limit";
import { sendBarkPush } from "@/services/bark";
import { getSiteBaseUrl } from "@/services/site-url";
import { createNotification } from "@/services/notifications";
import {
  decryptPaymentConfigForUse,
  parsePaymentConfig,
} from "@/services/payment/catalog";
import type { ManualQrConfig } from "@/services/payment/manual-qr";

const manualConfirmSchema = z.object({
  orderId: z.string().trim().min(1, "订单 ID 不能为空"),
});

const orderStatusLabel: Record<string, string> = {
  PENDING: "待支付",
  PAID: "已支付",
  CANCELLED: "已取消",
  REFUNDED: "已退款",
};

async function getManualQrBarkUrl() {
  try {
    const config = await prisma.paymentConfig.findUnique({
      where: { provider: "manual_qr" },
      select: { enabled: true, config: true },
    });
    if (!config?.enabled) return "";

    const parsed = parsePaymentConfig(
      "manual_qr",
      decryptPaymentConfigForUse("manual_qr", config.config as Record<string, unknown>),
    ) as ManualQrConfig;

    return parsed.barkUrl?.trim() || "";
  } catch (error) {
    console.error("Load manual_qr Bark config failed:", error);
    return "";
  }
}

function buildAdminReviewUrl(baseUrl: string, tradeNo: string | null) {
  if (!baseUrl) return null;
  const url = new URL("/admin/orders", baseUrl);
  url.searchParams.set("status", "PENDING");
  url.searchParams.set("reviewStatus", "FLAGGED");
  if (tradeNo) url.searchParams.set("q", tradeNo);
  return url.toString();
}

function formatAmount(amount: unknown) {
  return `¥${Number(amount).toFixed(2)}`;
}

async function notifyAdminsForManualPayment({
  order,
  reviewUrl,
  barkUrl,
}: {
  order: {
    id: string;
    tradeNo: string | null;
    amount: unknown;
    user: { email: string; name: string | null };
    plan: { name: string };
  };
  reviewUrl: string | null;
  barkUrl: string;
}) {
  const title = "J-Board 收款码付款待审核";
  const body = [
    `用户：${order.user.email}${order.user.name ? ` (${order.user.name})` : ""}`,
    `套餐：${order.plan.name}`,
    `金额：${formatAmount(order.amount)}`,
    `订单：${order.tradeNo ?? order.id}`,
    "请确认到账后在后台订单页点“确认”。",
  ].join("\n");

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", status: "ACTIVE" },
    select: { id: true },
  });

  await Promise.all(
    admins.map((admin) =>
      createNotification({
        userId: admin.id,
        type: "ORDER",
        level: "WARNING",
        title,
        body,
        link: reviewUrl ?? "/admin/orders?status=PENDING&reviewStatus=FLAGGED",
        dedupeKey: `manual-qr-review:${order.id}:${admin.id}`,
      }),
    ),
  );

  if (barkUrl) {
    await sendBarkPush({
      endpoint: barkUrl,
      title,
      body,
      url: reviewUrl,
    });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getActiveSession();
    if (!session) {
      return jsonError("未登录", { status: 401 });
    }

    const { success, remaining } = await rateLimit(
      `ratelimit:manual-payment:${session.user.id}`,
      10,
      60,
    );
    if (!success) {
      return jsonError("请求过于频繁，请稍后再试", {
        status: 429,
        headers: { "X-RateLimit-Remaining": String(remaining) },
      });
    }

    const payload = manualConfirmSchema.parse(await req.json());
    const order = await prisma.order.findUnique({
      where: { id: payload.orderId },
      select: {
        id: true,
        userId: true,
        status: true,
        paymentMethod: true,
        reviewStatus: true,
        tradeNo: true,
        amount: true,
        user: { select: { email: true, name: true } },
        plan: { select: { name: true } },
      },
    });

    if (!order || order.userId !== session.user.id) {
      return jsonError("订单不存在", { status: 404 });
    }

    if (order.status === "PAID") {
      return jsonOk({ status: "paid" as const });
    }

    if (order.status !== "PENDING") {
      return jsonError(`订单当前状态为 ${orderStatusLabel[order.status] ?? order.status}，无法提交付款审核`, {
        status: 400,
      });
    }

    if (order.paymentMethod !== "manual_qr") {
      return jsonError("这笔订单不是收款码付款审核支付", { status: 400 });
    }

    if (order.reviewStatus === "FLAGGED") {
      return jsonOk({ status: "reviewing" as const });
    }

    const now = new Date();
    const reviewNote = `收款码付款待审核：用户于 ${now.toISOString()} 点击“我已付款”，请核对到账后确认订单。`;
    await prisma.order.update({
      where: { id: order.id },
      data: {
        reviewStatus: "FLAGGED",
        reviewNote,
        note: null,
      },
    });

    const baseUrl = await getSiteBaseUrl({
      headers: req.headers,
      requestUrl: req.url,
      allowRequestFallback: true,
    });
    const reviewUrl = buildAdminReviewUrl(baseUrl, order.tradeNo);
    const barkUrl = await getManualQrBarkUrl();

    await notifyAdminsForManualPayment({
      order,
      reviewUrl,
      barkUrl,
    });

    return jsonOk({ status: "reviewing" as const });
  } catch (error) {
    return jsonError(error, { fallback: "提交付款审核失败" });
  }
}
