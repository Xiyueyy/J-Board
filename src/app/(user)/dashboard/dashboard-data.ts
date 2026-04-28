import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { prisma } from "@/lib/prisma";
import { getAppConfig } from "@/services/app-config";

export interface DashboardTrafficTrendPoint {
  date: string;
  valueGb: number;
}

export async function getDashboardData(userId: string) {
  const [activeSubs, pendingOrderCount, paidOrderCount, config] =
    await Promise.all([
      prisma.userSubscription.findMany({
        where: { userId, status: "ACTIVE" },
        include: {
          plan: true,
          nodeClient: { include: { inbound: true } },
          streamingSlot: { include: { service: true } },
        },
        orderBy: { endDate: "asc" },
      }),
      prisma.order.count({ where: { userId, status: "PENDING" } }),
      prisma.order.count({ where: { userId, status: "PAID" } }),
      getAppConfig(),
    ]);

  return { activeSubs, pendingOrderCount, paidOrderCount, config };
}

export async function getDashboardTrafficTrend(
  clientIds: string[],
): Promise<DashboardTrafficTrendPoint[]> {
  const trafficWindowStart = new Date();
  trafficWindowStart.setDate(trafficWindowStart.getDate() - 7);

  const recentTrafficLogs =
    clientIds.length > 0
      ? await prisma.trafficLog.findMany({
          where: {
            clientId: { in: clientIds },
            timestamp: { gte: trafficWindowStart },
          },
          select: { timestamp: true, upload: true, download: true },
          orderBy: { timestamp: "asc" },
        })
      : [];

  const trafficByDay = new Map<string, number>();
  for (const log of recentTrafficLogs) {
    const key = format(log.timestamp, "MM-dd", { locale: zhCN });
    const current = trafficByDay.get(key) ?? 0;
    trafficByDay.set(
      key,
      current + Number(log.upload + log.download) / 1024 ** 3,
    );
  }

  return Array.from(trafficByDay.entries()).map(([date, valueGb]) => ({
    date,
    valueGb: Number(valueGb.toFixed(2)),
  }));
}
