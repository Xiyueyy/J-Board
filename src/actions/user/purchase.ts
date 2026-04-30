"use server";

import { requireAuth } from "@/lib/require-auth";
import { prisma } from "@/lib/prisma";
import { getErrorMessage } from "@/lib/errors";
import {
  buildUnavailableMessage,
  formatAvailabilityDateTime,
  getPlanAvailability,
} from "@/services/plan-availability";
import {
  ensurePlanTrafficPoolCapacity,
  getPlanTrafficPoolState,
} from "@/services/plan-traffic-pool";
import { getPlanPurchasePrice, roundMoney } from "@/services/commerce";
import { confirmPendingOrder } from "@/services/payment/process";

async function assertNoPendingOrder(userId: string) {
  const pendingOrder = await prisma.order.findFirst({
    where: { userId, status: "PENDING" },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });

  if (pendingOrder) {
    throw new Error("你还有一笔订单正在等待支付，请先完成或取消后再继续购买");
  }
}

function getRenewalOrderPrice(
  plan: {
    durationDays: number;
    renewalPrice: unknown;
    renewalPricingMode: string;
    renewalDurationDays: number | null;
    renewalMinDays: number | null;
    renewalMaxDays: number | null;
  },
  requestedDays?: number,
) {
  const unitPrice = Number(plan.renewalPrice ?? 0);
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
    throw new Error("这款套餐暂时不支持续费");
  }

  const mode = plan.renewalPricingMode === "PER_DAY" ? "PER_DAY" : "FIXED_DURATION";
  if (mode === "PER_DAY") {
    const minDays = plan.renewalMinDays ?? 1;
    const maxDays = plan.renewalMaxDays ?? plan.durationDays;
    const durationDays = requestedDays ?? minDays;
    if (!Number.isInteger(durationDays) || durationDays < minDays || durationDays > maxDays) {
      throw new Error(`续费天数范围: ${minDays}-${maxDays} 天`);
    }
    return {
      durationDays,
      amount: roundMoney(unitPrice * durationDays),
    };
  }

  const unitDays = plan.renewalDurationDays ?? plan.durationDays;
  const minDays = plan.renewalMinDays ?? unitDays;
  const maxDays = plan.renewalMaxDays ?? unitDays;
  const durationDays = requestedDays ?? unitDays;
  if (!Number.isInteger(durationDays) || durationDays < minDays || durationDays > maxDays) {
    throw new Error(`续费天数范围: ${minDays}-${maxDays} 天`);
  }
  if (durationDays % unitDays !== 0) {
    throw new Error(`续费天数必须是 ${unitDays} 天的整数倍`);
  }

  return {
    durationDays,
    amount: roundMoney(unitPrice * (durationDays / unitDays)),
  };
}

function getTrafficTopupOrderPrice(
  plan: {
    topupPricingMode: string;
    topupPricePerGb: unknown;
    topupFixedPrice: unknown;
    minTopupGb: number | null;
    maxTopupGb: number | null;
    pricePerGb: unknown;
  },
  trafficGb: number,
) {
  const minTopupGb = plan.minTopupGb ?? 1;
  const maxTopupGb = plan.maxTopupGb ?? null;
  if (trafficGb < minTopupGb) {
    throw new Error(`单次至少增加 ${minTopupGb} GB`);
  }
  if (maxTopupGb != null && trafficGb > maxTopupGb) {
    throw new Error(`单次最多增加 ${maxTopupGb} GB`);
  }

  if (plan.topupPricingMode === "FIXED_AMOUNT") {
    const fixedAmount = Number(plan.topupFixedPrice ?? 0);
    if (!Number.isFinite(fixedAmount) || fixedAmount <= 0) {
      throw new Error("这款套餐暂时不能增加流量");
    }
    return roundMoney(fixedAmount);
  }

  const pricePerGb = Number(plan.topupPricePerGb ?? plan.pricePerGb ?? 0);
  if (!Number.isFinite(pricePerGb) || pricePerGb <= 0) {
    throw new Error("这款套餐暂时不能增加流量");
  }
  return roundMoney(pricePerGb * trafficGb);
}

function assertPlanVisible(plan: { name: string; isPublic: boolean }, role: string) {
  if (!plan.isPublic && role !== "ADMIN") {
    throw new Error(`${plan.name} 仅管理员可见，当前账号不能开通`);
  }
}

function getOrderPricing(amount: number, role: string) {
  const subtotalAmount = roundMoney(amount);
  if (role === "ADMIN") {
    return {
      amount: 0,
      subtotalAmount,
      discountAmount: subtotalAmount,
      promotionName: "管理员免费开通",
    };
  }

  return {
    amount: subtotalAmount,
    subtotalAmount,
    discountAmount: 0,
    promotionName: null,
  };
}

async function autoConfirmAdminOrder(orderId: string, role: string) {
  if (role !== "ADMIN") return;

  const result = await confirmPendingOrder(orderId);
  if (result.finalStatus !== "PAID") {
    throw new Error(result.errorMessage
      ? `管理员免费开通失败：${result.errorMessage}`
      : "管理员免费开通失败，请到订单页查看详情");
  }
}

type BundlePlanForPurchase = Awaited<ReturnType<typeof getBundlePlanForPurchase>>;

function getBundlePriceAmount(plan: { price: unknown; name: string }) {
  const amount = roundMoney(Number(plan.price ?? 0));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`${plan.name} 暂未设置有效售价`);
  }
  return amount;
}

async function getBundlePlanForPurchase(planId: string) {
  return prisma.subscriptionPlan.findUniqueOrThrow({
    where: { id: planId },
    include: {
      bundleItems: {
        include: {
          childPlan: {
            include: {
              inbound: true,
              inboundOptions: {
                include: { inbound: true },
                orderBy: { createdAt: "asc" },
              },
            },
          },
          selectedInbound: true,
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
}

function getBundleChildSelectableInboundIds(childPlan: BundlePlanForPurchase["bundleItems"][number]["childPlan"]) {
  if (childPlan.inboundOptions.length > 0) {
    return childPlan.inboundOptions
      .map((option) => option.inbound)
      .filter((inbound) => inbound.isActive && inbound.serverId === childPlan.nodeId)
      .map((inbound) => inbound.id);
  }

  if (childPlan.inbound && childPlan.inbound.isActive && childPlan.inbound.serverId === childPlan.nodeId) {
    return [childPlan.inbound.id];
  }

  return [];
}

async function buildBundleOrderItems(plan: BundlePlanForPurchase, userId: string, role: string) {
  if (plan.type !== "BUNDLE") {
    throw new Error(`套餐类型不匹配：${plan.name} 是 ${plan.type}，不能作为聚合套餐购买`);
  }
  if (!plan.isActive) throw new Error(`套餐已下架：${plan.name} 当前不可购买`);
  assertPlanVisible(plan, role);
  if (plan.bundleItems.length === 0) throw new Error(`${plan.name} 暂未配置打包内容`);

  const availability = await getPlanAvailability(plan, { userId });
  if (!availability.available) {
    throw new Error(buildUnavailableMessage(availability));
  }

  const orderItems: Array<{
    planId: string;
    selectedInboundId: string | null;
    trafficGb: number | null;
    unitAmount: number;
    amount: number;
  }> = [];
  const trafficByPlan = new Map<string, number>();

  for (const item of plan.bundleItems) {
    const childPlan = item.childPlan;
    if (!childPlan.isActive) {
      throw new Error(`${childPlan.name} 已下架，聚合套餐暂时不能购买`);
    }
    assertPlanVisible(childPlan, role);
    if (childPlan.type === "BUNDLE") {
      throw new Error("聚合套餐暂不支持嵌套购买另一个聚合套餐");
    }

    const childAvailability = await getPlanAvailability(childPlan, { userId });
    if (!childAvailability.available) {
      throw new Error(`${childPlan.name}：${buildUnavailableMessage(childAvailability)}`);
    }

    if (childPlan.type === "PROXY") {
      const trafficGb = item.trafficGb;
      if (!trafficGb || trafficGb <= 0) {
        throw new Error(`${childPlan.name} 缺少打包流量配置`);
      }
      const selectableInboundIds = getBundleChildSelectableInboundIds(childPlan);
      if (selectableInboundIds.length === 0) {
        throw new Error(`${childPlan.name} 的线路入口正在整理中，暂时不能购买`);
      }
      const selectedInboundId = item.selectedInboundId ?? selectableInboundIds[0];
      if (!selectableInboundIds.includes(selectedInboundId)) {
        throw new Error(`${childPlan.name} 的聚合入站已失效，请重新保存聚合套餐`);
      }

      trafficByPlan.set(childPlan.id, (trafficByPlan.get(childPlan.id) ?? 0) + trafficGb);
      orderItems.push({
        planId: childPlan.id,
        selectedInboundId,
        trafficGb,
        unitAmount: 0,
        amount: 0,
      });
    } else {
      orderItems.push({
        planId: childPlan.id,
        selectedInboundId: null,
        trafficGb: null,
        unitAmount: 0,
        amount: 0,
      });
    }
  }

  for (const [childPlanId, trafficGb] of trafficByPlan) {
    await ensurePlanTrafficPoolCapacity(childPlanId, trafficGb, {
      messagePrefix: "聚合套餐中的代理额度暂时不足",
    });
  }

  return orderItems;
}

export async function purchaseProxy(
  planId: string,
  trafficGb: number,
  selectedInboundId: string,
): Promise<string> {
  const session = await requireAuth();
  await assertNoPendingOrder(session.user.id);

  const plan = await prisma.subscriptionPlan.findUniqueOrThrow({
    where: { id: planId },
    include: {
      inboundOptions: {
        include: {
          inbound: {
            select: {
              id: true,
              isActive: true,
              serverId: true,
            },
          },
        },
      },
    },
  });

  if (plan.type !== "PROXY") throw new Error(`套餐类型不匹配：${plan.name} 是 ${plan.type}，不能作为代理套餐购买`);
  if (!plan.isActive) throw new Error(`套餐已下架：${plan.name} 当前不可购买`);
  assertPlanVisible(plan, session.user.role);

  const price = getPlanPurchasePrice(plan, trafficGb);

  const poolState = await getPlanTrafficPoolState(plan.id);
  if (poolState.enabled && price.trafficGb != null) {
    await ensurePlanTrafficPoolCapacity(plan.id, price.trafficGb, {
      messagePrefix: "这款套餐额度暂时不足",
    });
  }

  const availability = await getPlanAvailability(plan, { userId: session.user.id });
  if (!availability.available) {
    throw new Error(buildUnavailableMessage(availability));
  }

  const selectableInboundIds = plan.inboundOptions
    .filter(
      (item) =>
        item.inbound.isActive
        && (!plan.nodeId || item.inbound.serverId === plan.nodeId),
    )
    .map((item) => item.inboundId);

  let fallbackInboundId = "";
  if (plan.inboundId && plan.nodeId) {
    const fallbackInbound = await prisma.nodeInbound.findFirst({
      where: {
        id: plan.inboundId,
        serverId: plan.nodeId,
        isActive: true,
      },
      select: { id: true },
    });
    fallbackInboundId = fallbackInbound?.id ?? "";
  }

  const selectable = selectableInboundIds.length > 0 ? selectableInboundIds : [fallbackInboundId];

  if (!selectedInboundId || !selectable.filter(Boolean).includes(selectedInboundId)) {
    throw new Error("请选择有效的线路入口");
  }
  if (!selectable[0]) {
    throw new Error("这款套餐的线路入口正在整理中，暂时不能购买");
  }

  const orderPricing = getOrderPricing(price.amount, session.user.role);
  const order = await prisma.order.create({
    data: {
      userId: session.user.id,
      planId,
      kind: "NEW_PURCHASE",
      amount: orderPricing.amount,
      subtotalAmount: orderPricing.subtotalAmount,
      discountAmount: orderPricing.discountAmount,
      promotionName: orderPricing.promotionName,
      selectedInboundId,
      status: "PENDING",
      items: {
        create: {
          planId,
          selectedInboundId,
          trafficGb: price.trafficGb,
          unitAmount: price.unitAmount,
          amount: price.amount,
        },
      },
    },
  });

  await autoConfirmAdminOrder(order.id, session.user.role);
  return order.id;
}

export async function purchaseStreaming(planId: string): Promise<string> {
  const session = await requireAuth();
  await assertNoPendingOrder(session.user.id);

  const plan = await prisma.subscriptionPlan.findUniqueOrThrow({
    where: { id: planId },
  });

  if (plan.type !== "STREAMING") throw new Error(`套餐类型不匹配：${plan.name} 是 ${plan.type}，不能作为流媒体套餐购买`);
  if (!plan.isActive) throw new Error(`套餐已下架：${plan.name} 当前不可购买`);
  assertPlanVisible(plan, session.user.role);

  const availability = await getPlanAvailability(plan, { userId: session.user.id });
  if (!availability.available) {
    throw new Error(buildUnavailableMessage(availability));
  }

  const price = getPlanPurchasePrice(plan);
  const orderPricing = getOrderPricing(price.amount, session.user.role);
  const order = await prisma.order.create({
    data: {
      userId: session.user.id,
      planId,
      kind: "NEW_PURCHASE",
      amount: orderPricing.amount,
      subtotalAmount: orderPricing.subtotalAmount,
      discountAmount: orderPricing.discountAmount,
      promotionName: orderPricing.promotionName,
      status: "PENDING",
      items: {
        create: {
          planId,
          trafficGb: null,
          unitAmount: price.unitAmount,
          amount: price.amount,
        },
      },
    },
  });

  await autoConfirmAdminOrder(order.id, session.user.role);
  return order.id;
}

export async function purchaseBundle(planId: string): Promise<string> {
  const session = await requireAuth();
  await assertNoPendingOrder(session.user.id);

  const plan = await getBundlePlanForPurchase(planId);
  const amount = getBundlePriceAmount(plan);
  const orderItems = await buildBundleOrderItems(plan, session.user.id, session.user.role);
  const orderPricing = getOrderPricing(amount, session.user.role);

  const order = await prisma.order.create({
    data: {
      userId: session.user.id,
      planId: plan.id,
      kind: "NEW_PURCHASE",
      amount: orderPricing.amount,
      subtotalAmount: orderPricing.subtotalAmount,
      discountAmount: orderPricing.discountAmount,
      promotionName: orderPricing.promotionName,
      status: "PENDING",
      items: {
        create: orderItems,
      },
    },
  });

  await autoConfirmAdminOrder(order.id, session.user.role);
  return order.id;
}

export type PurchaseRenewalResult =
  | { ok: true; orderId: string }
  | { ok: false; error: string };

export async function purchaseRenewal(
  subscriptionId: string,
  renewalDays?: number,
): Promise<PurchaseRenewalResult> {
  try {
    const session = await requireAuth();
    await assertNoPendingOrder(session.user.id);

    const subscription = await prisma.userSubscription.findFirst({
      where: { id: subscriptionId, userId: session.user.id },
      include: {
        plan: true,
      },
    });
    if (!subscription) throw new Error("订阅不存在");
    if (subscription.status !== "ACTIVE" || subscription.endDate <= new Date()) {
      throw new Error("仅支持对活跃订阅续费");
    }
    if (!subscription.plan.allowRenewal) {
      throw new Error("这款套餐暂时不支持续费");
    }

    const price = getRenewalOrderPrice(subscription.plan, renewalDays);
    const order = await prisma.order.create({
      data: {
        userId: session.user.id,
        planId: subscription.planId,
        kind: "RENEWAL",
        targetSubscriptionId: subscription.id,
        amount: price.amount,
        subtotalAmount: price.amount,
        discountAmount: 0,
        durationDays: price.durationDays,
        status: "PENDING",
      },
    });
    return { ok: true, orderId: order.id };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error, "创建续费订单失败") };
  }
}

export async function purchaseTrafficTopup(
  subscriptionId: string,
  trafficGb: number,
): Promise<string> {
  const session = await requireAuth();
  await assertNoPendingOrder(session.user.id);

  if (!Number.isFinite(trafficGb) || trafficGb <= 0 || !Number.isInteger(trafficGb)) {
    throw new Error("增流量必须是正整数 GB");
  }

  const subscription = await prisma.userSubscription.findFirst({
    where: { id: subscriptionId, userId: session.user.id },
    include: {
      plan: true,
    },
  });
  if (!subscription) throw new Error("订阅不存在");
  if (subscription.plan.type !== "PROXY") {
    throw new Error("仅代理订阅支持增流量");
  }
  if (subscription.status !== "ACTIVE" || subscription.endDate <= new Date()) {
    throw new Error("增流量仅在当前套餐有效期内生效");
  }
  if (!subscription.plan.allowTrafficTopup) {
    throw new Error("这款套餐暂时不支持增加流量");
  }

  const amount = getTrafficTopupOrderPrice(subscription.plan, trafficGb);
  const poolState = await getPlanTrafficPoolState(subscription.planId);
  if (poolState.enabled) {
    const remainingGb = Math.max(0, Math.floor(poolState.remainingGb));
    if (trafficGb > remainingGb) {
      throw new Error(`剩余总流量不足，当前最多可增 ${remainingGb} GB`);
    }
  }
  const order = await prisma.order.create({
    data: {
      userId: session.user.id,
      planId: subscription.planId,
      kind: "TRAFFIC_TOPUP",
      targetSubscriptionId: subscription.id,
      amount,
      subtotalAmount: amount,
      discountAmount: 0,
      trafficGb,
      status: "PENDING",
    },
  });
  return order.id;
}

export async function queryPlanNextAvailability(planId: string): Promise<{
  available: boolean;
  message: string;
  nextAvailableAt: string | null;
}> {
  const session = await requireAuth();

  const plan = await prisma.subscriptionPlan.findUniqueOrThrow({
    where: { id: planId },
    select: {
      id: true,
      type: true,
      totalLimit: true,
      perUserLimit: true,
      streamingServiceId: true,
      isActive: true,
    },
  });

  if (!plan.isActive) {
    return {
      available: false,
      message: "这款套餐暂时不可购买",
      nextAvailableAt: null,
    };
  }

  const availability = await getPlanAvailability(plan, { userId: session.user.id });
  return {
    available: availability.available,
    message: availability.available ? "这款套餐现在可以购买" : buildUnavailableMessage(availability),
    nextAvailableAt: availability.nextAvailableAt
      ? formatAvailabilityDateTime(availability.nextAvailableAt)
      : null,
  };
}
