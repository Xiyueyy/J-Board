import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const adminUserDetailInclude = {
  invitedBy: {
    select: {
      id: true,
      email: true,
    },
  },
  _count: {
    select: {
      subscriptions: true,
      orders: true,
      invitedUsers: true,
      supportTickets: true,
      notifications: true,
    },
  },
} satisfies Prisma.UserInclude;

export type AdminUserDetail = Prisma.UserGetPayload<{
  include: typeof adminUserDetailInclude;
}>;

export async function getAdminUserDetail(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: adminUserDetailInclude,
  });

  if (!user) return null;

  const [subscriptions, orders, riskEvents, supportTickets] = await Promise.all([
    prisma.userSubscription.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        status: true,
        endDate: true,
        trafficUsed: true,
        trafficLimit: true,
        createdAt: true,
        plan: { select: { name: true, type: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    prisma.order.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        amount: true,
        status: true,
        kind: true,
        createdAt: true,
        plan: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.subscriptionRiskEvent.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.supportTicket.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        subject: true,
        status: true,
        priority: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 8,
    }),
  ]);

  return { user, subscriptions, orders, riskEvents, supportTickets };
}
