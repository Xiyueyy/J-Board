import { prisma } from "@/lib/prisma";

export async function getCommerceData() {
  const [coupons, promotions] = await Promise.all([
    prisma.coupon.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { orders: true, grants: true } } },
      take: 30,
    }),
    prisma.promotionRule.findMany({
      orderBy: [{ sortOrder: "asc" }, { thresholdAmount: "asc" }],
      take: 30,
    }),
  ]);

  return { coupons, promotions };
}
