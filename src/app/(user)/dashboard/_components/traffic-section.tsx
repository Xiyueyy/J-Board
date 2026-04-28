import { TrafficTrendChartLazy } from "@/components/shared/traffic-trend-chart-lazy";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardTrafficTrendPoint } from "../dashboard-data";

export function TrafficSection({ trend }: { trend: DashboardTrafficTrendPoint[] }) {
  return (
    <section>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">近 7 天流量趋势</CardTitle>
        </CardHeader>
        <CardContent>
          <TrafficTrendChartLazy
            data={trend}
            color="oklch(0.52 0.13 172)"
          />
        </CardContent>
      </Card>
    </section>
  );
}

export function TrafficSectionSkeleton() {
  return (
    <section>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">近 7 天流量趋势</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    </section>
  );
}
