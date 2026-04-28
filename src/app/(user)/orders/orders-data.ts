import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parsePage } from "@/lib/utils";

const userOrderInclude = {
  plan: true,
} satisfies Prisma.OrderInclude;

export type UserOrderRow = Prisma.OrderGetPayload<{
  include: typeof userOrderInclude;
}>;

export async function getUserOrders({
  userId,
  searchParams,
}: {
  userId: string;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const { page, skip, pageSize } = parsePage(searchParams);
  const where = { userId } satisfies Prisma.OrderWhereInput;

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: userOrderInclude,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.order.count({ where }),
  ]);

  return { orders, total, page, pageSize };
}
