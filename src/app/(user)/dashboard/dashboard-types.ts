import type { Prisma } from "@prisma/client";

export type DashboardSubscription = Prisma.UserSubscriptionGetPayload<{
  include: {
    plan: true;
    nodeClient: { include: { inbound: true } };
    streamingSlot: { include: { service: true } };
  };
}>;

export interface TrafficOverview {
  totalUsed: number;
  totalLimit: number;
  totalRemaining: number;
  usagePercent: number;
}

export interface UpcomingExpiry {
  sub: DashboardSubscription;
  daysLeft: number;
}
