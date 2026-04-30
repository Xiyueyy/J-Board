"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/require-auth";
import {
  buildUnavailableMessage,
  getPlanAvailability,
} from "@/services/plan-availability";
import {
  getPlanPurchasePrice,
  calculateCheckoutDiscounts,
  roundMoney,
} from "@/services/commerce";
import { ensurePlanTrafficPoolCapacity } from "@/services/plan-traffic-pool";
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
      couponId: null as string | null,
      couponCode: null as string | null,
      couponGrantId: null as string | null,
      promotionName: "管理员免费开通",
    };
  }

  return null;
}

async function getCheckoutPricing({
  userId,
  role,
  subtotal,
  couponCode,
}: {
  userId: string;
  role: string;
  subtotal: number;
  couponCode?: string | null;
}) {
  const adminPricing = getOrderPricing(subtotal, role);
  if (adminPricing) return adminPricing;

  const discounts = await calculateCheckoutDiscounts({
    userId,
    subtotal,
    couponCode,
  });

  return {
    amount: discounts.payable,
    subtotalAmount: discounts.subtotal,
    discountAmount: discounts.totalDiscount,
    couponId: discounts.coupon?.id ?? null,
    couponCode: discounts.coupon?.code ?? null,
    couponGrantId: discounts.couponGrantId,
    promotionName: discounts.promotion?.name ?? null,
  };
}

async function autoConfirmAdminOrder(orderId: string, role: string) {
  if (role !== "ADMIN") return;

  const result = await confirmPendingOrder(orderId);
  if (result.finalStatus !== "PAID") {
    throw new Error(
      result.errorMessage
        ? `管理员免费开通失败：${result.errorMessage}`
        : "管理员免费开通失败，请到订单页查看详情",
    );
  }
}

async function assertCartHasNoBundle(userId: string) {
  const bundleItem = await prisma.shoppingCartItem.findFirst({
    where: { userId, plan: { type: "BUNDLE" } },
    select: { id: true },
  });
  if (bundleItem) {
    throw new Error("聚合套餐需要单独结算，请先移出购物车里的聚合套餐");
  }
}

async function assertBundleCanBeSingleCartItem(userId: string, planId: string) {
  const otherItem = await prisma.shoppingCartItem.findFirst({
    where: {
      userId,
      NOT: { planId },
    },
    select: { id: true },
  });
  if (otherItem) {
    throw new Error("聚合套餐需要单独结算，请先清空购物车或移出其它套餐");
  }
}

async function getProxyPlanForCart(planId: string) {
  const plan = await prisma.subscriptionPlan.findUniqueOrThrow({
    where: { id: planId },
    include: {
      inboundOptions: {
        include: {
          inbound: {
            select: { id: true, serverId: true, isActive: true },
          },
        },
      },
    },
  });

  if (plan.type !== "PROXY")
    throw new Error(
      `套餐类型不匹配：${plan.name} 是 ${plan.type}，不能作为代理套餐加入购物车`,
    );
  if (!plan.isActive) throw new Error(`套餐已下架：${plan.name} 当前不可购买`);
  return plan;
}

type BundlePlanForCart = Awaited<ReturnType<typeof getBundlePlanForCart>>;

async function getBundlePlanForCart(planId: string) {
  const plan = await prisma.subscriptionPlan.findUniqueOrThrow({
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

  if (plan.type !== "BUNDLE")
    throw new Error(
      `套餐类型不匹配：${plan.name} 是 ${plan.type}，不能作为聚合套餐加入购物车`,
    );
  if (!plan.isActive) throw new Error(`套餐已下架：${plan.name} 当前不可购买`);
  if (plan.bundleItems.length === 0)
    throw new Error(`${plan.name} 暂未配置打包内容`);
  return plan;
}

function assertInboundSelectable(
  plan: Awaited<ReturnType<typeof getProxyPlanForCart>>,
  selectedInboundId: string,
) {
  const selectableInboundIds = plan.inboundOptions
    .filter(
      (item) =>
        item.inbound.isActive &&
        (!plan.nodeId || item.inbound.serverId === plan.nodeId),
    )
    .map((item) => item.inboundId);

  const selectable =
    selectableInboundIds.length > 0
      ? selectableInboundIds
      : plan.inboundId
        ? [plan.inboundId]
        : [];

  if (!selectedInboundId || !selectable.includes(selectedInboundId)) {
    throw new Error("请选择有效的线路入口");
  }
}

function getBundleChildSelectableInboundIds(
  childPlan: BundlePlanForCart["bundleItems"][number]["childPlan"],
) {
  if (childPlan.inboundOptions.length > 0) {
    return childPlan.inboundOptions
      .map((option) => option.inbound)
      .filter(
        (inbound) => inbound.isActive && inbound.serverId === childPlan.nodeId,
      )
      .map((inbound) => inbound.id);
  }

  if (
    childPlan.inbound &&
    childPlan.inbound.isActive &&
    childPlan.inbound.serverId === childPlan.nodeId
  ) {
    return [childPlan.inbound.id];
  }

  return [];
}

async function buildBundleOrderItems(plan: BundlePlanForCart, userId: string, role: string) {
  assertPlanVisible(plan, role);

  const availability = await getPlanAvailability(plan, { userId });
  if (!availability.available) {
    throw new Error(`${plan.name}：${buildUnavailableMessage(availability)}`);
  }

  const orderItems: Array<{
    planId: string;
    selectedInboundId: string | null;
    trafficGb: number | null;
    unitAmount: number;
    amount: number;
  }> = [];
  const trafficByPlan = new Map<string, number>();

  for (const bundleItem of plan.bundleItems) {
    const childPlan = bundleItem.childPlan;
    if (!childPlan.isActive) {
      throw new Error(`${childPlan.name} 已下架，请先移出购物车`);
    }
    assertPlanVisible(childPlan, role);
    if (childPlan.type === "BUNDLE") {
      throw new Error("聚合套餐暂不支持嵌套另一个聚合套餐");
    }

    const childAvailability = await getPlanAvailability(childPlan, { userId });
    if (!childAvailability.available) {
      throw new Error(
        `${childPlan.name}：${buildUnavailableMessage(childAvailability)}`,
      );
    }

    if (childPlan.type === "PROXY") {
      const trafficGb = bundleItem.trafficGb;
      if (!trafficGb || trafficGb <= 0)
        throw new Error(`${childPlan.name} 缺少打包流量配置`);

      const selectableInboundIds =
        getBundleChildSelectableInboundIds(childPlan);
      if (selectableInboundIds.length === 0) {
        throw new Error(`${childPlan.name} 的线路入口正在整理中，暂时不能购买`);
      }

      const selectedInboundId =
        bundleItem.selectedInboundId ?? selectableInboundIds[0];
      if (!selectableInboundIds.includes(selectedInboundId)) {
        throw new Error(
          `${childPlan.name} 的聚合入站已失效，请重新保存聚合套餐`,
        );
      }

      trafficByPlan.set(
        childPlan.id,
        (trafficByPlan.get(childPlan.id) ?? 0) + trafficGb,
      );
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

  return { orderItems, trafficByPlan };
}

export async function addProxyPlanToCart(
  planId: string,
  trafficGb: number,
  selectedInboundId: string,
) {
  const session = await requireAuth();
  const plan = await getProxyPlanForCart(planId);
  assertPlanVisible(plan, session.user.role);
  await assertCartHasNoBundle(session.user.id);
  assertInboundSelectable(plan, selectedInboundId);

  const price = getPlanPurchasePrice(plan, trafficGb);
  if (price.trafficGb != null) {
    await ensurePlanTrafficPoolCapacity(plan.id, price.trafficGb, {
      messagePrefix: "这款套餐额度暂时不足",
    });
  }

  const availability = await getPlanAvailability(plan, {
    userId: session.user.id,
  });
  if (!availability.available) {
    throw new Error(buildUnavailableMessage(availability));
  }

  const existing = await prisma.shoppingCartItem.findFirst({
    where: {
      userId: session.user.id,
      planId,
      selectedInboundId,
      trafficGb: price.trafficGb,
    },
    select: { id: true },
  });

  if (existing) {
    await prisma.shoppingCartItem.update({
      where: { id: existing.id },
      data: { updatedAt: new Date() },
    });
  } else {
    await prisma.shoppingCartItem.create({
      data: {
        userId: session.user.id,
        planId,
        selectedInboundId,
        trafficGb: price.trafficGb,
      },
    });
  }

  revalidatePath("/cart");
  revalidatePath("/store");
}

export async function addStreamingPlanToCart(planId: string) {
  const session = await requireAuth();
  const plan = await prisma.subscriptionPlan.findUniqueOrThrow({
    where: { id: planId },
  });
  if (plan.type !== "STREAMING")
    throw new Error(
      `套餐类型不匹配：${plan.name} 是 ${plan.type}，不能作为流媒体套餐加入购物车`,
    );
  if (!plan.isActive) throw new Error(`套餐已下架：${plan.name} 当前不可购买`);
  assertPlanVisible(plan, session.user.role);
  await assertCartHasNoBundle(session.user.id);

  const availability = await getPlanAvailability(plan, {
    userId: session.user.id,
  });
  if (!availability.available) {
    throw new Error(buildUnavailableMessage(availability));
  }

  const existing = await prisma.shoppingCartItem.findFirst({
    where: {
      userId: session.user.id,
      planId,
      selectedInboundId: null,
      trafficGb: null,
    },
    select: { id: true },
  });

  if (existing) {
    await prisma.shoppingCartItem.update({
      where: { id: existing.id },
      data: { updatedAt: new Date() },
    });
  } else {
    await prisma.shoppingCartItem.create({
      data: { userId: session.user.id, planId },
    });
  }

  revalidatePath("/cart");
  revalidatePath("/store");
}

export async function addBundlePlanToCart(planId: string) {
  const session = await requireAuth();
  const plan = await getBundlePlanForCart(planId);
  assertPlanVisible(plan, session.user.role);
  await assertBundleCanBeSingleCartItem(session.user.id, planId);
  const { trafficByPlan } = await buildBundleOrderItems(plan, session.user.id, session.user.role);

  for (const [childPlanId, trafficGb] of trafficByPlan) {
    await ensurePlanTrafficPoolCapacity(childPlanId, trafficGb, {
      messagePrefix: "聚合套餐中的代理额度暂时不足",
    });
  }

  const existing = await prisma.shoppingCartItem.findFirst({
    where: {
      userId: session.user.id,
      planId,
      selectedInboundId: null,
      trafficGb: null,
    },
    select: { id: true },
  });

  if (existing) {
    await prisma.shoppingCartItem.update({
      where: { id: existing.id },
      data: { updatedAt: new Date() },
    });
  } else {
    await prisma.shoppingCartItem.create({
      data: { userId: session.user.id, planId },
    });
  }

  revalidatePath("/cart");
  revalidatePath("/store");
}

export async function removeCartItem(itemId: string) {
  const session = await requireAuth();
  await prisma.shoppingCartItem.deleteMany({
    where: { id: itemId, userId: session.user.id },
  });
  revalidatePath("/cart");
  revalidatePath("/store");
}

export async function clearCart() {
  const session = await requireAuth();
  await prisma.shoppingCartItem.deleteMany({
    where: { userId: session.user.id },
  });
  revalidatePath("/cart");
  revalidatePath("/store");
}

export async function checkoutCart(
  couponCode?: string | null,
): Promise<string> {
  const session = await requireAuth();
  await assertNoPendingOrder(session.user.id);

  const items = await prisma.shoppingCartItem.findMany({
    where: { userId: session.user.id },
    include: {
      plan: {
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
      },
      selectedInbound: true,
    },
    orderBy: { createdAt: "asc" },
  });

  if (items.length === 0) throw new Error("购物车还是空的");
  if (items.some((item) => item.plan.type === "BUNDLE") && items.length > 1) {
    throw new Error("聚合套餐需要单独结算，请先移出其它套餐");
  }

  const orderItems: Array<{
    planId: string;
    selectedInboundId: string | null;
    trafficGb: number | null;
    unitAmount: number;
    amount: number;
  }> = [];
  const trafficByPlan = new Map<string, number>();
  let subtotal = 0;

  for (const item of items) {
    if (!item.plan.isActive)
      throw new Error(`${item.plan.name} 已下架，请先移出购物车`);
    assertPlanVisible(item.plan, session.user.role);

    if (item.plan.type === "PROXY") {
      const availability = await getPlanAvailability(item.plan, {
        userId: session.user.id,
      });
      if (!availability.available) {
        throw new Error(
          `${item.plan.name}：${buildUnavailableMessage(availability)}`,
        );
      }
      if (!item.selectedInboundId)
        throw new Error(`${item.plan.name} 缺少线路入口`);
      const plan = await getProxyPlanForCart(item.planId);
      assertInboundSelectable(plan, item.selectedInboundId);
      const price = getPlanPurchasePrice(item.plan, item.trafficGb);
      if (!price.trafficGb) throw new Error(`${item.plan.name} 缺少流量配置`);
      subtotal += price.amount;
      trafficByPlan.set(
        item.planId,
        (trafficByPlan.get(item.planId) ?? 0) + price.trafficGb,
      );
      orderItems.push({
        planId: item.planId,
        selectedInboundId: item.selectedInboundId,
        trafficGb: price.trafficGb,
        unitAmount: price.unitAmount,
        amount: price.amount,
      });
    } else if (item.plan.type === "STREAMING") {
      const availability = await getPlanAvailability(item.plan, {
        userId: session.user.id,
      });
      if (!availability.available) {
        throw new Error(
          `${item.plan.name}：${buildUnavailableMessage(availability)}`,
        );
      }
      const price = getPlanPurchasePrice(item.plan);
      subtotal += price.amount;
      orderItems.push({
        planId: item.planId,
        selectedInboundId: null,
        trafficGb: null,
        unitAmount: price.unitAmount,
        amount: price.amount,
      });
    } else {
      const price = getPlanPurchasePrice(item.plan);
      if (price.amount <= 0)
        throw new Error(`${item.plan.name} 暂未设置有效售价`);
      subtotal += price.amount;

      const {
        orderItems: bundleOrderItems,
        trafficByPlan: bundleTrafficByPlan,
      } = await buildBundleOrderItems(item.plan, session.user.id, session.user.role);
      orderItems.push(...bundleOrderItems);
      for (const [childPlanId, trafficGb] of bundleTrafficByPlan) {
        trafficByPlan.set(
          childPlanId,
          (trafficByPlan.get(childPlanId) ?? 0) + trafficGb,
        );
      }
    }
  }

  for (const [planId, trafficGb] of trafficByPlan) {
    await ensurePlanTrafficPoolCapacity(planId, trafficGb, {
      messagePrefix: "购物车中的代理套餐额度暂时不足",
    });
  }

  const checkoutPricing = await getCheckoutPricing({
    userId: session.user.id,
    role: session.user.role,
    subtotal,
    couponCode,
  });

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        userId: session.user.id,
        planId: items[0].planId,
        kind: "NEW_PURCHASE",
        amount: checkoutPricing.amount,
        subtotalAmount: checkoutPricing.subtotalAmount,
        discountAmount: checkoutPricing.discountAmount,
        couponId: checkoutPricing.couponId,
        couponCode: checkoutPricing.couponCode,
        promotionName: checkoutPricing.promotionName,
        status: "PENDING",
        items: {
          create: orderItems,
        },
      },
    });

    if (checkoutPricing.couponGrantId) {
      await tx.couponGrant.update({
        where: { id: checkoutPricing.couponGrantId },
        data: { usedOrderId: created.id, usedAt: new Date() },
      });
    }

    await tx.shoppingCartItem.deleteMany({
      where: { userId: session.user.id },
    });
    return created;
  });

  await autoConfirmAdminOrder(order.id, session.user.role);

  revalidatePath("/cart");
  revalidatePath("/store");
  revalidatePath("/orders");

  return order.id;
}
