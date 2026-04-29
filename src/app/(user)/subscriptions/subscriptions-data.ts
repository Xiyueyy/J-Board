import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getSubscriptionBaseUrl as resolveSubscriptionBaseUrl } from "@/services/site-url";
import {
  getPlanTrafficPoolState,
  type PlanTrafficPoolState,
} from "@/services/plan-traffic-pool";
import { getActiveSubscriptions, getProxyPlanIds } from "./subscriptions-calculations";
import type { SubscriptionRecord } from "./subscriptions-types";

export async function getUserSubscriptions(userId: string): Promise<SubscriptionRecord[]> {
  return prisma.userSubscription.findMany({
    where: { userId },
    include: {
      plan: { include: { node: true, category: true } },
      nodeClient: { include: { inbound: { include: { server: true } } } },
      streamingSlot: { include: { service: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getSubscriptionBaseUrl() {
  const requestHeaders = await headers();
  return resolveSubscriptionBaseUrl({ headers: requestHeaders });
}

export async function getTrafficPoolMap(subscriptions: SubscriptionRecord[]) {
  const activeSubs = getActiveSubscriptions(subscriptions);
  const proxyPlanIds = getProxyPlanIds(activeSubs);
  const poolEntries = await Promise.all(
    proxyPlanIds.map(async (planId) => [planId, await getPlanTrafficPoolState(planId)] as const),
  );

  return new Map<string, PlanTrafficPoolState>(poolEntries);
}
