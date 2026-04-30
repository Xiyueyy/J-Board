import { prisma } from "@/lib/prisma";
import { getPlanPurchasePrice } from "@/services/commerce";

function getInboundDisplayName(inbound: { tag: string; settings: unknown } | null) {
  if (!inbound) return "优选线路入口";
  const settings = inbound.settings;
  if (settings && typeof settings === "object" && "displayName" in settings) {
    const value = (settings as { displayName?: unknown }).displayName;
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return inbound.tag || "优选线路入口";
}

export async function getCartPageData(userId: string) {
  const [items, publicCoupons, grantedCoupons, promotions] = await Promise.all([
    prisma.shoppingCartItem.findMany({
      where: { userId },
      include: {
        plan: {
          include: {
            category: true,
            streamingService: true,
            node: true,
            bundleItems: {
              include: {
                childPlan: true,
                selectedInbound: true,
              },
              orderBy: { sortOrder: "asc" },
            },
          },
        },
        selectedInbound: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.coupon.findMany({
      where: { isActive: true, isPublic: true },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.couponGrant.findMany({
      where: { userId, usedOrderId: null, coupon: { isActive: true } },
      include: { coupon: true },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.promotionRule.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { thresholdAmount: "asc" }],
      take: 5,
    }),
  ]);

  const mappedItems = items.map((item) => {
    const price = getPlanPurchasePrice(item.plan, item.trafficGb);
    return {
      id: item.id,
      planId: item.planId,
      name: item.plan.name,
      type: item.plan.type,
      categoryName: item.plan.category?.name
        ?? (item.plan.type === "PROXY"
          ? "代理连接"
          : item.plan.type === "BUNDLE"
            ? "聚合套餐"
            : "流媒体共享"),
      description: item.plan.description,
      durationDays: item.plan.durationDays,
      amount: price.amount,
      priceLabel: price.label,
      trafficGb: price.trafficGb,
      nodeName: item.plan.node?.name ?? null,
      serviceName: item.plan.streamingService?.name ?? null,
      inboundName: getInboundDisplayName(item.selectedInbound),
      bundleSummary: item.plan.type === "BUNDLE"
        ? item.plan.bundleItems
            .map((bundleItem) => [
              bundleItem.childPlan.name,
              bundleItem.selectedInbound ? getInboundDisplayName(bundleItem.selectedInbound) : null,
            ].filter(Boolean).join(" · "))
            .join(" / ")
        : null,
    };
  });

  const subtotal = mappedItems.reduce((sum, item) => sum + item.amount, 0);

  const coupons = [
    ...grantedCoupons.map((grant) => ({
      id: grant.coupon.id,
      code: grant.coupon.code,
      name: grant.coupon.name,
      description: grant.coupon.description,
      private: true,
      thresholdAmount: grant.coupon.thresholdAmount == null ? null : Number(grant.coupon.thresholdAmount),
      discountType: grant.coupon.discountType,
      discountValue: Number(grant.coupon.discountValue),
    })),
    ...publicCoupons.map((coupon) => ({
      id: coupon.id,
      code: coupon.code,
      name: coupon.name,
      description: coupon.description,
      private: false,
      thresholdAmount: coupon.thresholdAmount == null ? null : Number(coupon.thresholdAmount),
      discountType: coupon.discountType,
      discountValue: Number(coupon.discountValue),
    })),
  ];

  return {
    items: mappedItems,
    subtotal,
    coupons,
    promotions: promotions.map((rule) => ({
      id: rule.id,
      name: rule.name,
      thresholdAmount: Number(rule.thresholdAmount),
      discountAmount: Number(rule.discountAmount),
    })),
  };
}
