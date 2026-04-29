import { ChevronDown, Globe2, MapPin } from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDate } from "@/lib/utils";
import type { SubscriptionRiskGeoSummary } from "@/services/subscription-risk-review";

function projectPoint(latitude: number, longitude: number) {
  return {
    x: ((longitude + 180) / 360) * 360,
    y: ((90 - latitude) / 180) * 180,
  };
}

function radiusForAccess(count: number) {
  return Math.min(7, Math.max(3, 2 + Math.sqrt(count)));
}

function WorldRiskMap({ summary }: { summary: SubscriptionRiskGeoSummary }) {
  const points = summary.points.slice(0, 60);

  return (
    <div className="overflow-hidden rounded-lg border border-border/70 bg-muted/20">
      <svg
        viewBox="0 0 360 180"
        className="h-48 w-full"
        role="img"
        aria-label="订阅访问 IP 世界地图分布"
      >
        <defs>
          <linearGradient id="risk-map-water" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--muted)" stopOpacity="0.68" />
            <stop offset="100%" stopColor="var(--card)" stopOpacity="0.94" />
          </linearGradient>
        </defs>
        <rect width="360" height="180" rx="12" fill="url(#risk-map-water)" />
        {[-120, -60, 0, 60, 120].map((longitude) => {
          const x = ((longitude + 180) / 360) * 360;
          return <line key={longitude} x1={x} x2={x} y1="12" y2="168" stroke="var(--border)" strokeDasharray="2 5" strokeOpacity="0.7" />;
        })}
        {[-45, 0, 45].map((latitude) => {
          const y = ((90 - latitude) / 180) * 180;
          return <line key={latitude} x1="12" x2="348" y1={y} y2={y} stroke="var(--border)" strokeDasharray="2 5" strokeOpacity="0.7" />;
        })}
        <g fill="var(--card)" stroke="var(--border)" strokeWidth="1" opacity="0.92">
          <path d="M39 50 61 35 91 39 116 57 106 78 82 80 72 106 54 97 36 69Z" />
          <path d="M86 93 105 103 113 129 100 158 82 144 75 118Z" />
          <path d="M132 47 160 36 191 41 215 35 251 48 286 58 303 79 276 95 246 89 220 102 190 91 169 98 144 82Z" />
          <path d="M174 89 198 98 208 126 195 158 172 139 158 107Z" />
          <path d="M281 116 306 110 326 126 316 147 289 145 270 130Z" />
          <path d="M295 72 330 69 342 83 325 94 300 89Z" />
          <path d="M126 33 146 26 168 32 151 42Z" />
        </g>
        <g>
          {points.map((point) => {
            const { x, y } = projectPoint(point.latitude, point.longitude);
            return (
              <g key={point.key}>
                <title>{point.ip + " / " + point.country + " / " + point.region + " / " + point.city}</title>
                <circle
                  cx={x}
                  cy={y}
                  r={radiusForAccess(point.accessCount) + 2}
                  fill={point.allowed ? "var(--primary)" : "var(--destructive)"}
                  opacity="0.16"
                />
                <circle
                  cx={x}
                  cy={y}
                  r={radiusForAccess(point.accessCount)}
                  fill={point.allowed ? "var(--primary)" : "var(--destructive)"}
                  stroke="var(--card)"
                  strokeWidth="1.5"
                />
              </g>
            );
          })}
        </g>
      </svg>
      <div className="flex items-center justify-between border-t border-border/60 px-3 py-2 text-xs text-muted-foreground">
        <span>{points.length > 0 ? "已标注 " + points.length + " 个坐标点" : "没有可用经纬度坐标"}</span>
        <span>圆点越大表示访问越集中</span>
      </div>
    </div>
  );
}

export function SubscriptionRiskGeoDetails({ summary }: { summary: SubscriptionRiskGeoSummary }) {
  return (
    <details className="group min-w-[24rem] rounded-lg border border-border/70 bg-muted/20 text-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-background text-primary">
            <Globe2 className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block font-medium">地区与 IP 证据</span>
            <span className="block truncate text-xs text-muted-foreground">
              {summary.uniqueCountryCount} 国 / {summary.uniqueRegionCount} 省区 / {summary.uniqueCityCount} 城市 / {summary.uniqueIpCount} IP
            </span>
          </span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>

      <div className="border-t border-border/60 p-3">
        <div className="grid gap-3 xl:grid-cols-[minmax(20rem,1.1fr)_minmax(16rem,0.9fr)]">
          <WorldRiskMap summary={summary} />

          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md border border-border/60 bg-background/70 p-2">
                <p className="text-xs text-muted-foreground">访问记录</p>
                <p className="mt-1 font-mono text-base font-semibold">{summary.totalLogs}</p>
              </div>
              <div className="rounded-md border border-border/60 bg-background/70 p-2">
                <p className="text-xs text-muted-foreground">不同 IP</p>
                <p className="mt-1 font-mono text-base font-semibold">{summary.uniqueIpCount}</p>
              </div>
            </div>

            <div className="max-h-44 space-y-2 overflow-auto pr-1">
              {summary.countries.length === 0 ? (
                <p className="rounded-md border border-dashed border-border/70 p-3 text-xs text-muted-foreground">
                  暂无可识别地区数据，可能是 GeoIP 未命中或访问来源未携带有效 IP。
                </p>
              ) : (
                summary.countries.map((country) => (
                  <div key={country.country} className="rounded-md border border-border/60 bg-background/70 p-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="break-words font-medium">{country.country}</p>
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">{country.accessCount} 次</span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {country.ipCount} IP · {country.regionCount} 省/地区 · {country.cityCount} 城市
                    </p>
                    {(country.topRegions.length > 0 || country.topCities.length > 0) && (
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                        省区：{country.topRegions.join("、") || "未识别"}；城市：{country.topCities.join("、") || "未识别"}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <MapPin className="size-3.5" /> 最近访问明细
          </div>
          <div className="grid gap-2 lg:grid-cols-2">
            {summary.recentAccesses.length === 0 ? (
              <p className="rounded-md border border-dashed border-border/70 p-3 text-xs text-muted-foreground">暂无访问明细。</p>
            ) : (
              summary.recentAccesses.slice(0, 6).map((access) => (
                <div key={access.id} className="min-w-0 rounded-md border border-border/60 bg-background/70 p-2 text-xs leading-5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-mono">{access.ip}</span>
                    <StatusBadge tone={access.allowed ? "success" : "warning"}>
                      {access.allowed ? "放行" : access.reason || "拦截"}
                    </StatusBadge>
                  </div>
                  <p className="mt-1 break-words text-muted-foreground">{access.location}</p>
                  <p className="text-muted-foreground">{formatDate(access.createdAt)}</p>
                  {access.userAgent && <p className="mt-1 truncate text-muted-foreground">{access.userAgent}</p>}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </details>
  );
}
