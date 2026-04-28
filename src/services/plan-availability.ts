import { prisma } from "@/lib/prisma";
import type { SubscriptionPlan, SubscriptionType } from "@prisma/client";
import { format } from "date-fns";

type PlanAvailabilityInput = Pick<
  SubscriptionPlan,
  "id" | "type" | "totalLimit" | "streamingServiceId" | "perUserLimit"
>;

type AvailabilityReason = "PLAN_LIMIT" | "SERVICE_CAPACITY" | "USER_LIMIT";

export interface PlanAvailability {
  available: boolean;
  reason: AvailabilityReason | null;
  activeCount: number;
  totalLimit: number | null;
  remainingByPlanLimit: number | null;
  remainingByServiceCapacity: number | null;
  remainingByUserLimit: number | null;
  nextAvailableAt: Date | null;
}

export function formatAvailabilityDateTime(date: Date): string {
  return format(date, "yyyy-MM-dd HH:mm");
}

export function buildUnavailableMessage(availability: PlanAvailability): string {
  if (availability.available) return "当前可购买";

  const prefix =
    availability.reason === "SERVICE_CAPACITY"
      ? "当前服务名额已满"
      : availability.reason === "USER_LIMIT"
        ? "你已达到该套餐限购数量"
        : "当前套餐名额已满";

  if (!availability.nextAvailableAt) {
    return `${prefix}，暂时无法预测释放时间`;
  }

  return `${prefix}，预计最早可购买时间：${formatAvailabilityDateTime(availability.nextAvailableAt)}`;
}

async function getEarliestPlanExpiry(planId: string): Promise<Date | null> {
  const earliest = await prisma.userSubscription.findFirst({
    where: {
      planId,
      status: "ACTIVE",
    },
    select: { endDate: true },
    orderBy: { endDate: "asc" },
  });

  return earliest?.endDate ?? null;
}

async function getEarliestUserPlanExpiry(
  planId: string,
  userId: string,
): Promise<Date | null> {
  const earliest = await prisma.userSubscription.findFirst({
    where: {
      planId,
      userId,
      status: "ACTIVE",
    },
    select: { endDate: true },
    orderBy: { endDate: "asc" },
  });

  return earliest?.endDate ?? null;
}

async function getEarliestServiceExpiry(serviceIds: string[]): Promise<Date | null> {
  if (serviceIds.length === 0) return null;

  const earliest = await prisma.userSubscription.findFirst({
    where: {
      status: "ACTIVE",
      streamingSlot: {
        is: {
          serviceId: { in: serviceIds },
        },
      },
    },
    select: { endDate: true },
    orderBy: { endDate: "asc" },
  });

  return earliest?.endDate ?? null;
}

async function evaluateStreamingCapacity(
  type: SubscriptionType,
  streamingServiceId: string | null,
): Promise<{
  blocked: boolean;
  remaining: number | null;
  nextAvailableAt: Date | null;
}> {
  if (type !== "STREAMING") {
    return { blocked: false, remaining: null, nextAvailableAt: null };
  }

  if (streamingServiceId) {
    const service = await prisma.streamingService.findUnique({
      where: { id: streamingServiceId },
      select: {
        id: true,
        isActive: true,
        maxSlots: true,
        usedSlots: true,
      },
    });

    if (!service || !service.isActive) {
      return { blocked: true, remaining: 0, nextAvailableAt: null };
    }

    const remaining = Math.max(0, service.maxSlots - service.usedSlots);
    if (remaining > 0) {
      return { blocked: false, remaining, nextAvailableAt: null };
    }

    const nextAvailableAt = await getEarliestServiceExpiry([service.id]);
    return { blocked: true, remaining: 0, nextAvailableAt };
  }

  const services = await prisma.streamingService.findMany({
    where: { isActive: true },
    select: { id: true, maxSlots: true, usedSlots: true },
  });

  const totalRemaining = services.reduce(
    (sum, service) => sum + Math.max(0, service.maxSlots - service.usedSlots),
    0,
  );
  if (totalRemaining > 0) {
    return { blocked: false, remaining: totalRemaining, nextAvailableAt: null };
  }

  const nextAvailableAt = await getEarliestServiceExpiry(services.map((service) => service.id));
  return { blocked: true, remaining: 0, nextAvailableAt };
}

function resolveNextAvailability(
  blockers: Array<{ reason: AvailabilityReason; nextAt: Date | null }>,
): { reason: AvailabilityReason | null; nextAvailableAt: Date | null } {
  if (blockers.length === 0) {
    return { reason: null, nextAvailableAt: null };
  }

  if (blockers.length === 1) {
    return {
      reason: blockers[0].reason,
      nextAvailableAt: blockers[0].nextAt,
    };
  }

  if (blockers.some((item) => !item.nextAt)) {
    return {
      reason: blockers[0].reason,
      nextAvailableAt: null,
    };
  }

  const sorted = [...blockers].sort(
    (a, b) => (b.nextAt?.getTime() ?? 0) - (a.nextAt?.getTime() ?? 0),
  );
  return { reason: sorted[0].reason, nextAvailableAt: sorted[0].nextAt };
}

export async function getPlanAvailability(
  plan: PlanAvailabilityInput,
  options?: { userId?: string },
): Promise<PlanAvailability> {
  const activeCount = await prisma.userSubscription.count({
    where: {
      planId: plan.id,
      status: "ACTIVE",
    },
  });

  const totalLimit = plan.totalLimit ?? null;
  const remainingByPlanLimit =
    totalLimit == null ? null : Math.max(0, totalLimit - activeCount);
  const planBlocked = remainingByPlanLimit !== null && remainingByPlanLimit <= 0;
  const planNextAt = planBlocked ? await getEarliestPlanExpiry(plan.id) : null;

  let remainingByUserLimit: number | null = null;
  let userBlocked = false;
  let userNextAt: Date | null = null;
  if (plan.perUserLimit != null && options?.userId) {
    const userActiveCount = await prisma.userSubscription.count({
      where: {
        planId: plan.id,
        userId: options.userId,
        status: "ACTIVE",
      },
    });
    remainingByUserLimit = Math.max(0, plan.perUserLimit - userActiveCount);
    userBlocked = remainingByUserLimit <= 0;
    if (userBlocked) {
      userNextAt = await getEarliestUserPlanExpiry(plan.id, options.userId);
    }
  }

  const streaming = await evaluateStreamingCapacity(
    plan.type,
    plan.streamingServiceId ?? null,
  );
  const blockers: Array<{ reason: AvailabilityReason; nextAt: Date | null }> = [];
  if (userBlocked) blockers.push({ reason: "USER_LIMIT", nextAt: userNextAt });
  if (planBlocked) blockers.push({ reason: "PLAN_LIMIT", nextAt: planNextAt });
  if (streaming.blocked) {
    blockers.push({ reason: "SERVICE_CAPACITY", nextAt: streaming.nextAvailableAt });
  }
  const resolution = resolveNextAvailability(blockers);

  return {
    available: !userBlocked && !planBlocked && !streaming.blocked,
    reason: resolution.reason,
    activeCount,
    totalLimit,
    remainingByPlanLimit,
    remainingByServiceCapacity: streaming.remaining,
    remainingByUserLimit,
    nextAvailableAt: resolution.nextAvailableAt,
  };
}

export async function getPlanAvailabilityById(planId: string): Promise<PlanAvailability> {
  const plan = await prisma.subscriptionPlan.findUniqueOrThrow({
    where: { id: planId },
    select: {
      id: true,
      type: true,
      totalLimit: true,
      streamingServiceId: true,
      perUserLimit: true,
    },
  });

  return getPlanAvailability(plan);
}
