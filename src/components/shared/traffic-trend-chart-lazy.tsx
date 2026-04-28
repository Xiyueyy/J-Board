"use client";

import dynamic from "next/dynamic";

export const TrafficTrendChartLazy = dynamic(
  () =>
    import("./traffic-trend-chart").then((mod) => mod.TrafficTrendChart),
  {
    loading: () => (
      <div className="h-64 w-full flex items-center justify-center">
        <p className="text-sm text-muted-foreground">加载图表中...</p>
      </div>
    ),
    ssr: false,
  },
);
