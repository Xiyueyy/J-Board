import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const userSubscriptionDetailInclude = {
  plan: { include: { node: true, category: true } },
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

export type UserSubscriptionDetail = Prisma.UserSubscriptionGetPayload<{
  include: typeof userSubscriptionDetailInclude;
}>;

export async function getUserSubscriptionDetail({
  subscriptionId,
  userId,
}: {
  subscriptionId: string;
  userId: string;
}) {
  const subscription = await prisma.userSubscription.findFirst({
    where: {
      id: subscriptionId,
      userId,
    },
    include: userSubscriptionDetailInclude,
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
      take: 50,
    }),
    subscription.nodeClient
      ? prisma.trafficLog.findMany({
          where: { clientId: subscription.nodeClient.id },
          orderBy: { timestamp: "desc" },
          take: 20,
        })
      : [],
  ]);

  return { subscription, auditLogs, trafficLogs };
}
