import { Gauge } from "lucide-react";
import { EmptyState } from "@/components/shared/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatBytes } from "@/lib/utils";
import type { TrafficOverview } from "../dashboard-types";

interface ProxyTrafficOverviewCardProps {
  proxyCount: number;
  traffic: TrafficOverview;
}

export function ProxyTrafficOverviewCard({
  proxyCount,
  traffic,
}: ProxyTrafficOverviewCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">代理流量总览</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {proxyCount === 0 ? (
          <EmptyState
            icon={<Gauge className="size-5" />}
            title="还没有代理流量"
            description="购买代理套餐后这里将显示流量用量汇总。"
            className="border-0 bg-transparent px-3 py-8"
          />
        ) : traffic.totalLimit > 0 ? (
          <>
            <div className="flex justify-between text-sm">
              <span>已用 {formatBytes(traffic.totalUsed)}</span>
              <span>总量 {formatBytes(traffic.totalLimit)}</span>
            </div>
            <Progress value={traffic.usagePercent} className="h-2" />
            <p className="text-xs text-muted-foreground">
              总体剩余 {formatBytes(traffic.totalRemaining)}（
              {Math.max(0, 100 - traffic.usagePercent)}%）
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            当前代理套餐未设置总流量上限
          </p>
        )}
      </CardContent>
    </Card>
  );
}
