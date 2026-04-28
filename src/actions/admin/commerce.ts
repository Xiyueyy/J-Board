"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-auth";
import { actorFromSession, recordAuditLog } from "@/services/audit";

const optionalNumber = z.preprocess(
  (value) => (value === "" || value == null ? undefined : Number(value)),
  z.number().optional(),
);
const optionalInt = z.preprocess(
  (value) => (value === "" || value == null ? undefined : Number(value)),
  z.number().int().optional(),
);

const couponSchema = z.object({
  code: z.string().trim().min(2).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
  discountType: z.enum(["AMOUNT_OFF", "PERCENT_OFF"]),
  discountValue: z.coerce.number().positive(),
  thresholdAmount: optionalNumber,
  maxDiscountAmount: optionalNumber,
  totalLimit: optionalInt,
  perUserLimit: optionalInt,
  isPublic: z.string().optional(),
});

const promotionSchema = z.object({
  name: z.string().trim().min(1),
  thresholdAmount: z.coerce.number().positive(),
  discountAmount: z.coerce.number().positive(),
  sortOrder: z.coerce.number().int().default(100),
});

export async function createCoupon(formData: FormData) {
  const session = await requireAdmin();
  const data = couponSchema.parse(Object.fromEntries(formData));
  if (data.discountType === "PERCENT_OFF" && data.discountValue > 100) {
    throw new Error("折扣百分比不能超过 100");
  }
  const coupon = await prisma.coupon.create({
    data: {
      code: data.code,
      name: data.name,
      description: data.description || null,
      discountType: data.discountType,
      discountValue: data.discountValue,
      thresholdAmount: data.thresholdAmount ?? null,
      maxDiscountAmount: data.maxDiscountAmount ?? null,
      totalLimit: data.totalLimit ?? null,
      perUserLimit: data.perUserLimit ?? null,
      isPublic: data.isPublic === "true",
    },
  });
  await recordAuditLog({
    actor: actorFromSession(session),
    action: "coupon.create",
    targetType: "Coupon",
    targetId: coupon.id,
    targetLabel: coupon.code,
    message: `创建优惠券 ${coupon.code}`,
  });
  revalidateCommerce();
}

export async function toggleCoupon(id: string, isActive: boolean) {
  const session = await requireAdmin();
  const coupon = await prisma.coupon.update({ where: { id }, data: { isActive } });
  await recordAuditLog({
    actor: actorFromSession(session),
    action: "coupon.toggle",
    targetType: "Coupon",
    targetId: id,
    targetLabel: coupon.code,
    message: `${isActive ? "启用" : "停用"}优惠券 ${coupon.code}`,
  });
  revalidateCommerce();
}

export async function createPromotionRule(formData: FormData) {
  const session = await requireAdmin();
  const data = promotionSchema.parse(Object.fromEntries(formData));
  if (data.discountAmount >= data.thresholdAmount) {
    throw new Error("满减金额应小于门槛金额");
  }
  const rule = await prisma.promotionRule.create({
    data: {
      name: data.name,
      thresholdAmount: data.thresholdAmount,
      discountAmount: data.discountAmount,
      sortOrder: data.sortOrder,
    },
  });
  await recordAuditLog({
    actor: actorFromSession(session),
    action: "promotion.create",
    targetType: "PromotionRule",
    targetId: rule.id,
    targetLabel: rule.name,
    message: `创建满减规则 ${rule.name}`,
  });
  revalidateCommerce();
}

export async function togglePromotionRule(id: string, isActive: boolean) {
  const session = await requireAdmin();
  const rule = await prisma.promotionRule.update({ where: { id }, data: { isActive } });
  await recordAuditLog({
    actor: actorFromSession(session),
    action: "promotion.toggle",
    targetType: "PromotionRule",
    targetId: id,
    targetLabel: rule.name,
    message: `${isActive ? "启用" : "停用"}满减规则 ${rule.name}`,
  });
  revalidateCommerce();
}

function revalidateCommerce() {
  revalidatePath("/admin/commerce");
  revalidatePath("/admin/plans");
  revalidatePath("/store");
  revalidatePath("/cart");
}
