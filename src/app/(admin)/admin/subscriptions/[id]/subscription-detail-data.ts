import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const adminSubscriptionDetailInclude = {
  user: true,
  plan: true,
  nodeClient: {
    include: {
      inbound: {
        include: {
          server: true,
        },
      },
    },
  },
  streamingSlot: {
    include: {
      service: true,
    },
  },
} satisfies Prisma.UserSubscriptionInclude;

export type AdminSubscriptionDetail = Prisma.UserSubscriptionGetPayload<{
  include: typeof adminSubscriptionDetailInclude;
}>;

export async function getAdminSubscriptionDetail(subscriptionId: string) {
  const subscription = await prisma.userSubscription.findUnique({
    where: { id: subscriptionId },
    include: adminSubscriptionDetailInclude,
  });

  if (!subscription) {
    return null;
  }

  const [auditLogs, trafficLogs] = await Promise.all([
    prisma.auditLog.findMany({
      where: {
        targetType: "UserSubscription",
        targetId: subscription.id,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    subscription.nodeClient
      ? prisma.trafficLog.findMany({
          where: {
            clientId: subscription.nodeClient.id,
          },
          orderBy: { timestamp: "desc" },
          take: 30,
        })
      : Promise.resolve([]),
  ]);

  return { subscription, auditLogs, trafficLogs };
}
