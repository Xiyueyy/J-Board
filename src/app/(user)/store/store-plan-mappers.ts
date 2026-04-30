import type { Prisma } from "@prisma/client";
import {
  formatAvailabilityDateTime,
  type PlanAvailability,
} from "@/services/plan-availability";
import { normalizeTraceText } from "@/lib/trace-normalize";
import type { ProxyPlan } from "./proxy-plan-types";
import type { StreamingPlan } from "./streaming-plan-types";
import type { BundlePlan } from "./bundle-plan-types";

export type StorePlanRecord = Prisma.SubscriptionPlanGetPayload<{
  include: {
    node: true;
    inbound: true;
    streamingService: true;
    inboundOptions: {
      include: { inbound: true };
    };
    bundleItems: {
      include: {
        childPlan: {
          include: {
            node: true;
            inbound: true;
            streamingService: true;
            inboundOptions: {
              include: { inbound: true };
            };
          };
        };
        selectedInbound: true;
      };
    };
  };
}>;

export function getProxyPlans(plans: StorePlanRecord[]) {
  return plans.filter((plan) => plan.type === "PROXY");
}

export function getStreamingPlans(plans: StorePlanRecord[]) {
  return plans.filter((plan) => plan.type === "STREAMING");
}

export function getBundlePlans(plans: StorePlanRecord[]) {
  return plans.filter((plan) => plan.type === "BUNDLE");
}

export function getProxyNodeIds(plans: StorePlanRecord[]) {
  const ids = new Set<string>();
  for (const plan of plans) {
    if (plan.nodeId) ids.add(plan.nodeId);
  }
  return [...ids];
}

export function toProxyPlanCard(plan: StorePlanRecord, availability?: PlanAvailability): ProxyPlan {
  const inboundOptions = getAvailableInboundOptions(plan);

  return {
    id: plan.id,
    name: normalizeTraceText(plan.name),
    description: plan.description ? normalizeTraceText(plan.description) : null,
    sortOrder: plan.sortOrder,
    durationDays: plan.durationDays,
    pricingMode: plan.pricingMode,
    pricePerGb: Number(plan.pricePerGb ?? 0),
    fixedTrafficGb: plan.fixedTrafficGb,
    fixedPrice: plan.fixedPrice == null ? null : Number(plan.fixedPrice),
    minTrafficGb: plan.pricingMode === "FIXED_PACKAGE" ? (plan.fixedTrafficGb ?? plan.minTrafficGb ?? 10) : (plan.minTrafficGb ?? 10),
    maxTrafficGb: plan.pricingMode === "FIXED_PACKAGE" ? (plan.fixedTrafficGb ?? plan.maxTrafficGb ?? 1000) : (plan.maxTrafficGb ?? 1000),
    nodeId: plan.nodeId,
    nodeName: plan.node?.name ? normalizeTraceText(plan.node.name) : "未知节点",
    inboundOptions: inboundOptions.map((inbound) => ({
      id: inbound.id,
      protocol: inbound.protocol,
      port: inbound.port,
      tag: normalizeTraceText(inbound.tag),
      displayName: getInboundDisplayName(inbound),
    })),
    totalLimit: plan.totalLimit,
    perUserLimit: plan.perUserLimit,
    activeCount: availability?.activeCount ?? 0,
    remainingCount: availability?.remainingByPlanLimit ?? null,
    remainingByUserLimit: availability?.remainingByUserLimit ?? null,
    isAvailable: availability?.available ?? true,
    nextAvailableAt: formatNextAvailableAt(availability),
  };
}

export function toStreamingPlanCard(
  plan: StorePlanRecord,
  availability?: PlanAvailability,
): StreamingPlan {
  return {
    id: plan.id,
    name: normalizeTraceText(plan.name),
    description: plan.description ? normalizeTraceText(plan.description) : null,
    sortOrder: plan.sortOrder,
    durationDays: plan.durationDays,
    price: Number(plan.price),
    serviceName: plan.streamingService?.name ? normalizeTraceText(plan.streamingService.name) : null,
    totalLimit: plan.totalLimit,
    perUserLimit: plan.perUserLimit,
    activeCount: availability?.activeCount ?? 0,
    remainingCount: getStreamingRemainingCount(availability),
    remainingByUserLimit: availability?.remainingByUserLimit ?? null,
    isAvailable: availability?.available ?? true,
    nextAvailableAt: formatNextAvailableAt(availability),
  };
}

export function toBundlePlanCard(
  plan: StorePlanRecord,
  availability?: PlanAvailability,
): BundlePlan {
  return {
    id: plan.id,
    name: normalizeTraceText(plan.name),
    description: plan.description ? normalizeTraceText(plan.description) : null,
    sortOrder: plan.sortOrder,
    durationDays: plan.durationDays,
    price: Number(plan.price ?? 0),
    items: plan.bundleItems.map((item) => ({
      id: item.id,
      name: normalizeTraceText(item.childPlan.name),
      type: item.childPlan.type === "PROXY" ? "PROXY" : "STREAMING",
      durationDays: plan.durationDays,
      trafficGb: item.trafficGb,
      nodeName: item.childPlan.node?.name ? normalizeTraceText(item.childPlan.node.name) : null,
      serviceName: item.childPlan.streamingService?.name
        ? normalizeTraceText(item.childPlan.streamingService.name)
        : null,
      inboundName: item.selectedInbound
        ? getInboundDisplayName(item.selectedInbound)
        : item.childPlan.inbound
          ? getInboundDisplayName(item.childPlan.inbound)
          : null,
    })),
    totalLimit: plan.totalLimit,
    perUserLimit: plan.perUserLimit,
    activeCount: availability?.activeCount ?? 0,
    remainingCount: availability?.remainingByPlanLimit ?? null,
    remainingByUserLimit: availability?.remainingByUserLimit ?? null,
    isAvailable: availability?.available ?? true,
    nextAvailableAt: formatNextAvailableAt(availability),
  };
}

function getAvailableInboundOptions(plan: StorePlanRecord) {
  if (plan.inboundOptions.length > 0) {
    return plan.inboundOptions
      .map((option) => option.inbound)
      .filter((inbound) => inbound.isActive && inbound.serverId === plan.nodeId);
  }

  if (plan.inbound && plan.inbound.isActive && plan.inbound.serverId === plan.nodeId) {
    return [plan.inbound];
  }

  return [];
}

function getStreamingRemainingCount(availability?: PlanAvailability) {
  if (!availability) return null;

  if (
    availability.remainingByPlanLimit == null &&
    availability.remainingByServiceCapacity != null
  ) {
    return availability.remainingByServiceCapacity;
  }

  return availability.remainingByPlanLimit ?? null;
}

function formatNextAvailableAt(availability?: PlanAvailability) {
  return availability?.nextAvailableAt
    ? formatAvailabilityDateTime(availability.nextAvailableAt)
    : null;
}


function getInboundDisplayName(inbound: { tag: string; settings: unknown }) {
  const settings = inbound.settings;
  if (settings && typeof settings === "object" && "displayName" in settings) {
    const value = (settings as { displayName?: unknown }).displayName;
    if (typeof value === "string" && value.trim()) {
      return normalizeTraceText(value);
    }
  }

  return normalizeTraceText(inbound.tag) || "优选线路入口";
}
