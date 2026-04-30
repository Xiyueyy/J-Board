import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parsePage } from "@/lib/utils";
import type { BundlePlanCandidate, StreamingServiceOption } from "./plan-form";

const planInclude = {
  node: true,
  inbound: true,
  streamingService: true,
  inboundOptions: {
    include: {
      inbound: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  },
  bundleItems: {
    include: {
      childPlan: {
        include: {
          inbound: true,
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
  _count: { select: { subscriptions: true } },
} satisfies Prisma.SubscriptionPlanInclude;

export type AdminPlanRow = Prisma.SubscriptionPlanGetPayload<{
  include: typeof planInclude;
}>;

export async function getAdminPlans(
  searchParams: Record<string, string | string[] | undefined>,
) {
  const { page, skip, pageSize } = parsePage(searchParams);
  const q = typeof searchParams.q === "string" ? searchParams.q.trim() : "";
  const type = typeof searchParams.type === "string" ? searchParams.type : "";
  const status = typeof searchParams.status === "string" ? searchParams.status : "";

  const where = {
    ...(type ? { type: type as "PROXY" | "STREAMING" | "BUNDLE" } : {}),
    ...(status ? { isActive: status === "active" } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { description: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  } satisfies Prisma.SubscriptionPlanWhereInput;

  const [plans, total, services, bundleCandidatePlans, activeGroups] = await Promise.all([
    prisma.subscriptionPlan.findMany({
      where,
      include: planInclude,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      skip,
      take: pageSize,
    }),
    prisma.subscriptionPlan.count({ where }),
    prisma.streamingService.findMany({
      where: { isActive: true },
      select: { id: true, name: true, usedSlots: true, maxSlots: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.subscriptionPlan.findMany({
      where: { isActive: true, type: { in: ["PROXY", "STREAMING"] } },
      include: {
        inbound: true,
        inboundOptions: {
          include: { inbound: true },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    }),
    prisma.userSubscription.groupBy({
      by: ["planId"],
      where: { status: "ACTIVE" },
      _count: { _all: true },
    }),
  ]);

  const activeCountMap = new Map(
    activeGroups.map((item) => [item.planId, item._count._all]),
  );
  const serviceOptions: StreamingServiceOption[] = services.map((service) => ({
    id: service.id,
    name: service.name,
    usedSlots: service.usedSlots,
    maxSlots: service.maxSlots,
  }));

  const bundleCandidates: BundlePlanCandidate[] = bundleCandidatePlans.map((plan) => {
    const inbounds = plan.inboundOptions.length > 0
      ? plan.inboundOptions.map((option) => option.inbound).filter((inbound) => inbound.isActive && inbound.serverId === plan.nodeId)
      : (plan.inbound && plan.inbound.isActive && plan.inbound.serverId === plan.nodeId ? [plan.inbound] : []);
    return {
      id: plan.id,
      name: plan.name,
      type: plan.type as "PROXY" | "STREAMING",
      pricingMode: plan.pricingMode,
      fixedTrafficGb: plan.fixedTrafficGb,
      minTrafficGb: plan.minTrafficGb,
      maxTrafficGb: plan.maxTrafficGb,
      inbounds: inbounds.map((inbound) => ({
        id: inbound.id,
        protocol: inbound.protocol,
        port: inbound.port,
        tag: inbound.tag,
        displayName:
          inbound.settings && typeof inbound.settings === "object" && !Array.isArray(inbound.settings)
            ? String((inbound.settings as { displayName?: unknown }).displayName || inbound.tag)
            : inbound.tag,
      })),
    };
  });

  return {
    plans,
    total,
    page,
    pageSize,
    filters: { q, type, status },
    activeCountMap,
    serviceOptions,
    bundleCandidates,
  };
}
