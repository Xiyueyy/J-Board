import type { StatusTone } from "@/components/shared/status-badge";
import {
  getSubscriptionStatusTone as getDomainSubscriptionStatusTone,
  getSubscriptionTypeTone,
  subscriptionStatusLabels,
  subscriptionTypeLabels,
} from "@/components/shared/domain-badges";
import type { PlanTrafficPoolState } from "@/services/plan-traffic-pool";
import type { SubscriptionRecord } from "./subscriptions-types";

export function getActiveSubscriptions(subscriptions: SubscriptionRecord[]) {
  return subscriptions.filter((sub) => sub.status === "ACTIVE");
}

export function getHistorySubscriptions(subscriptions: SubscriptionRecord[]) {
  return subscriptions.filter((sub) => sub.status !== "ACTIVE");
}

export function getProxyPlanIds(subscriptions: SubscriptionRecord[]) {
  return Array.from(
    new Set(
      subscriptions
        .filter((sub) => sub.plan.type === "PROXY")
        .map((sub) => sub.planId),
    ),
  );
}

export function getPlanTypeTone(type: SubscriptionRecord["plan"]["type"]): StatusTone {
  return getSubscriptionTypeTone(type);
}

export function getPlanTypeLabel(type: SubscriptionRecord["plan"]["type"]) {
  return subscriptionTypeLabels[type];
}

export function getSubscriptionStatusTone(status: SubscriptionRecord["status"]): StatusTone {
  return getDomainSubscriptionStatusTone(status);
}

export function getSubscriptionStatusLabel(status: SubscriptionRecord["status"]) {
  return subscriptionStatusLabels[status];
}

export function getTrafficPoolRemainingGb(
  sub: SubscriptionRecord,
  poolMap: Map<string, PlanTrafficPoolState>,
) {
  if (sub.plan.type !== "PROXY") return null;

  const poolState = poolMap.get(sub.planId);
  return poolState?.enabled ? poolState.remainingGb : null;
}
