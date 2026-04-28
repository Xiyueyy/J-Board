import type { Prisma, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const recentOrderInclude = {
  user: true,
  plan: true,
} satisfies Prisma.OrderInclude;

export type RecentAdminOrder = Prisma.OrderGetPayload<{
  include: typeof recentOrderInclude;
}>;

export type RecentAdminUser = User;

export async function getAdminDashboardStats() {
  const [userCount, activeSubCount, orderCount, nodeCount, revenue] = await Promise.all([
    prisma.user.count(),
    prisma.userSubscription.count({ where: { status: "ACTIVE" } }),
    prisma.order.count({ where: { status: "PAID" } }),
    prisma.nodeServer.count({ where: { status: "active" } }),
    prisma.order.aggregate({
      where: { status: "PAID" },
      _sum: { amount: true },
    }),
  ]);

  const totalRevenue = Number(revenue._sum.amount ?? 0);

  return [
    { label: "总用户", value: userCount },
    { label: "活跃订阅", value: activeSubCount },
    { label: "已完成订单", value: orderCount },
    { label: "在线节点", value: nodeCount },
    { label: "总收入", value: `¥${totalRevenue.toFixed(2)}` },
  ];
}

export async function getRecentAdminActivity() {
  const [recentOrders, recentUsers] = await Promise.all([
    prisma.order.findMany({
      include: recentOrderInclude,
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  return { recentOrders, recentUsers };
}
