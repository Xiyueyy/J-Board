import type {
  DashboardSubscription,
  TrafficOverview,
  UpcomingExpiry,
} from "./dashboard-types";

export function getProxySubscriptions(subscriptions: DashboardSubscription[]) {
  return subscriptions.filter((sub) => sub.plan.type === "PROXY");
}

export function getStreamingSubscriptions(subscriptions: DashboardSubscription[]) {
  return subscriptions.filter((sub) => sub.plan.type === "STREAMING");
}

export function getTrafficOverview(subscriptions: DashboardSubscription[]): TrafficOverview {
  const totalUsed = subscriptions.reduce(
    (sum, sub) => sum + Number(sub.trafficUsed),
    0,
  );
  const totalLimit = subscriptions.reduce(
    (sum, sub) => sum + Number(sub.trafficLimit ?? 0),
    0,
  );
  const totalRemaining = Math.max(0, totalLimit - totalUsed);
  const usagePercent =
    totalLimit > 0
      ? Math.min(100, Math.round((totalUsed / totalLimit) * 100))
      : 0;

  return { totalUsed, totalLimit, totalRemaining, usagePercent };
}

export function getProxyClientIds(subscriptions: DashboardSubscription[]) {
  return subscriptions
    .map((sub) => sub.nodeClient?.id)
    .filter((id): id is string => Boolean(id));
}

export function getUpcomingExpiries(
  subscriptions: DashboardSubscription[],
  now = new Date(),
): UpcomingExpiry[] {
  const nowMs = now.getTime();

  return subscriptions.slice(0, 5).map((sub) => ({
    sub,
    daysLeft: Math.max(
      0,
      Math.ceil((sub.endDate.getTime() - nowMs) / (1000 * 60 * 60 * 24)),
    ),
  }));
}
