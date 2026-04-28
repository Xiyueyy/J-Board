import type { Coupon, PromotionRule, SubscriptionPlan } from "@prisma/client";
import { prisma, type DbClient } from "@/lib/prisma";

export interface PurchasePriceSnapshot {
  trafficGb: number | null;
  unitAmount: number;
  amount: number;
  label: string;
}

export interface CheckoutDiscountSnapshot {
  subtotal: number;
  coupon: Coupon | null;
  couponDiscount: number;
  promotion: PromotionRule | null;
  promotionDiscount: number;
  totalDiscount: number;
  payable: number;
}

export function roundMoney(value: number) {
  return Math.max(0, Math.round(value * 100) / 100);
}

export function normalizeCouponCode(code?: string | null) {
  const value = (code ?? "").trim().toUpperCase();
  return value || null;
}

export function getPlanPurchasePrice(
  plan: Pick<
    SubscriptionPlan,
    | "type"
    | "price"
    | "pricePerGb"
    | "minTrafficGb"
    | "maxTrafficGb"
    | "pricingMode"
    | "fixedTrafficGb"
    | "fixedPrice"
    | "durationDays"
  >,
  requestedTrafficGb?: number | null,
): PurchasePriceSnapshot {
  if (plan.type === "STREAMING") {
    const amount = roundMoney(Number(plan.price ?? 0));
    return {
      trafficGb: null,
      unitAmount: amount,
      amount,
      label: `${plan.durationDays} 天`,
    };
  }

  if (plan.pricingMode === "FIXED_PACKAGE") {
    if (!plan.fixedTrafficGb || plan.fixedTrafficGb <= 0) {
      throw new Error("这款套餐暂时缺少固定流量设置");
    }
    if (!plan.fixedPrice || Number(plan.fixedPrice) <= 0) {
      throw new Error("这款套餐暂时缺少固定价格设置");
    }
    const amount = roundMoney(Number(plan.fixedPrice));
    return {
      trafficGb: plan.fixedTrafficGb,
      unitAmount: amount,
      amount,
      label: `${plan.fixedTrafficGb} GB · ${plan.durationDays} 天`,
    };
  }

  if (!plan.pricePerGb || Number(plan.pricePerGb) <= 0) {
    throw new Error("这款套餐暂时缺少价格设置");
  }

  const min = plan.minTrafficGb ?? 10;
  const max = plan.maxTrafficGb ?? 1000;
  const trafficGb = requestedTrafficGb ?? min;
  if (!Number.isInteger(trafficGb) || trafficGb < min || trafficGb > max) {
    throw new Error(`流量范围: ${min}-${max} GB`);
  }

  const unitAmount = Number(plan.pricePerGb);
  const amount = roundMoney(trafficGb * unitAmount);
  return {
    trafficGb,
    unitAmount,
    amount,
    label: `${trafficGb} GB · ${plan.durationDays} 天`,
  };
}

function isWithinDateWindow(item: { startsAt: Date | null; endsAt: Date | null }, now = new Date()) {
  if (item.startsAt && item.startsAt > now) return false;
  if (item.endsAt && item.endsAt < now) return false;
  return true;
}

function calculateCouponDiscount(
  coupon: Pick<Coupon, "discountType" | "discountValue" | "thresholdAmount" | "maxDiscountAmount">,
  subtotal: number,
) {
  const threshold = coupon.thresholdAmount == null ? 0 : Number(coupon.thresholdAmount);
  if (subtotal < threshold) return 0;

  let discount = 0;
  if (coupon.discountType === "PERCENT_OFF") {
    discount = subtotal * (Number(coupon.discountValue) / 100);
    if (coupon.maxDiscountAmount != null) {
      discount = Math.min(discount, Number(coupon.maxDiscountAmount));
    }
  } else {
    discount = Number(coupon.discountValue);
  }

  return Math.min(roundMoney(discount), subtotal);
}

async function getCouponForUser(
  userId: string,
  subtotal: number,
  couponCode?: string | null,
  db: DbClient = prisma,
) {
  const code = normalizeCouponCode(couponCode);
  if (!code) return { coupon: null, discount: 0, grantId: null as string | null };

  const coupon = await db.coupon.findUnique({ where: { code } });
  if (!coupon || !coupon.isActive || !isWithinDateWindow(coupon)) {
    throw new Error("这张优惠券暂时不可用");
  }

  const grant = await db.couponGrant.findFirst({
    where: {
      couponId: coupon.id,
      userId,
      usedOrderId: null,
    },
    orderBy: { createdAt: "asc" },
  });

  if (!coupon.isPublic && !grant) {
    throw new Error("这张优惠券不在你的可用券包里");
  }

  if (coupon.totalLimit != null) {
    const usedTotal = await db.order.count({
      where: { couponId: coupon.id, status: { in: ["PENDING", "PAID"] } },
    });
    if (usedTotal >= coupon.totalLimit) {
      throw new Error("这张优惠券已被领完");
    }
  }

  if (coupon.perUserLimit != null) {
    const usedByUser = await db.order.count({
      where: {
        couponId: coupon.id,
        userId,
        status: { in: ["PENDING", "PAID"] },
      },
    });
    if (usedByUser >= coupon.perUserLimit) {
      throw new Error("你已达到这张优惠券的使用次数");
    }
  }

  const discount = calculateCouponDiscount(coupon, subtotal);
  if (discount <= 0) {
    const threshold = coupon.thresholdAmount == null ? 0 : Number(coupon.thresholdAmount);
    throw new Error(threshold > 0 ? `订单满 ¥${threshold.toFixed(2)} 可用这张券` : "这张优惠券暂时不可用于当前订单");
  }

  return { coupon, discount, grantId: grant?.id ?? null };
}

async function getBestPromotion(subtotal: number, db: DbClient = prisma) {
  const rules = await db.promotionRule.findMany({
    where: {
      isActive: true,
      thresholdAmount: { lte: subtotal },
    },
    orderBy: [{ sortOrder: "asc" }, { thresholdAmount: "desc" }],
  });

  const valid = rules.filter((rule) => isWithinDateWindow(rule));
  if (valid.length === 0) return { promotion: null, discount: 0 };

  const best = valid
    .map((rule) => ({ rule, discount: Math.min(roundMoney(Number(rule.discountAmount)), subtotal) }))
    .sort((a, b) => b.discount - a.discount || a.rule.sortOrder - b.rule.sortOrder)[0];

  return { promotion: best.rule, discount: best.discount };
}

export async function calculateCheckoutDiscounts({
  userId,
  subtotal,
  couponCode,
  db = prisma,
}: {
  userId: string;
  subtotal: number;
  couponCode?: string | null;
  db?: DbClient;
}): Promise<CheckoutDiscountSnapshot & { couponGrantId: string | null }> {
  const couponResult = await getCouponForUser(userId, subtotal, couponCode, db);
  const promotionResult = await getBestPromotion(subtotal, db);
  const rawDiscount = Math.min(
    subtotal,
    roundMoney(couponResult.discount + promotionResult.discount),
  );
  const payable = subtotal > 0 ? Math.max(0.01, roundMoney(subtotal - rawDiscount)) : 0;
  const totalDiscount = roundMoney(subtotal - payable);

  return {
    subtotal,
    coupon: couponResult.coupon,
    couponDiscount: Math.min(couponResult.discount, totalDiscount),
    promotion: promotionResult.promotion,
    promotionDiscount: Math.max(0, totalDiscount - Math.min(couponResult.discount, totalDiscount)),
    totalDiscount,
    payable,
    couponGrantId: couponResult.grantId,
  };
}
