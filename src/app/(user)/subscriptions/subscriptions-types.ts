import type { Prisma } from "@prisma/client";

export type SubscriptionRecord = Prisma.UserSubscriptionGetPayload<{
  include: {
    plan: { include: { node: true; category: true } };
    nodeClient: { include: { inbound: { include: { server: true } } } };
    streamingSlot: { include: { service: true } };
  };
}>;
