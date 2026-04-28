import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { MetricCard } from "@/components/shared/metric-card";
import { formatBytes } from "@/lib/utils";
import type { TrafficOverview } from "../dashboard-types";

interface DashboardMetricGridProps {
  activeCount: number;
  proxyCount: number;
  streamingCount: number;
  pendingOrderCount: number;
  paidOrderCount: number;
  nearestExpiry: Date | null;
  traffic: TrafficOverview;
}

export function DashboardMetricGrid({
  activeCount,
  proxyCount,
  streamingCount,
  pendingOrderCount,
  paidOrderCount,
  nearestExpiry,
  traffic,
}: DashboardMetricGridProps) {
  return (
    <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        label="活跃订阅"
        value={activeCount}
        description={`代理 ${proxyCount} · 流媒体 ${streamingCount}`}
      />
      <MetricCard
        label="待支付订单"
        value={pendingOrderCount}
        description={`已完成订单 ${paidOrderCount}`}
      />
      <MetricCard
        label="总流量消耗"
        value={formatBytes(traffic.totalUsed)}
        description={`剩余 ${formatBytes(traffic.totalRemaining)}`}
      />
      <MetricCard
        label="最近到期"
        value={nearestExpiry ? format(nearestExpiry, "yyyy-MM-dd", { locale: zhCN }) : "暂无"}
        valueClassName="text-xl"
        description="到期请及时续费避免中断"
      />
    </section>
  );
}
