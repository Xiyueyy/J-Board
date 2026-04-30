import { prisma } from "@/lib/prisma";
import { normalizeTraceText } from "@/lib/trace-normalize";
import { getPlanAvailability, type PlanAvailability } from "@/services/plan-availability";
import { getLatencyRecommendations } from "@/services/latency-recommendations";

export async function getStorePageData(userId?: string, role?: string) {
  const [plans, pendingOrder, latencyRecommendations] = await Promise.all([
    prisma.subscriptionPlan.findMany({
      where: {
        isActive: true,
        ...(role === "ADMIN" ? {} : { isPublic: true }),
      },
      include: {
        node: true,
        inbound: true,
        streamingService: true,
        inboundOptions: {
          include: { inbound: true },
          orderBy: { createdAt: "asc" },
        },
        bundleItems: {
          include: {
            childPlan: {
              include: {
                node: true,
                inbound: true,
                streamingService: true,
                inboundOptions: {
                  include: { inbound: true },
                  orderBy: { createdAt: "asc" },
                },
              },
            },
            selectedInbound: true,
          },
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    }),
    userId
      ? prisma.order.findFirst({
          where: { userId, status: "PENDING" },
          include: { plan: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
        })
      : null,
    getLatencyRecommendations(),
  ]);

  const availabilityMap = new Map<string, PlanAvailability>();
  await Promise.all(
    plans.map(async (plan) => {
      const availability = await getPlanAvailability(plan, { userId });
      availabilityMap.set(plan.id, availability);
    }),
  );

  return {
    plans,
    availabilityMap,
    latencyRecommendations,
    pendingOrder: pendingOrder
      ? {
          id: pendingOrder.id,
          amount: Number(pendingOrder.amount),
          planName: normalizeTraceText(pendingOrder.plan.name),
          createdAt: pendingOrder.createdAt.toISOString(),
        }
      : null,
  };
}
