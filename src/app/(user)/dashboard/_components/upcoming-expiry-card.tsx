import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { CalendarClock } from "lucide-react";
import { EmptyState } from "@/components/shared/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import type { DashboardSubscription, UpcomingExpiry } from "../dashboard-types";

export function UpcomingExpiryCard({ items }: { items: UpcomingExpiry[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="size-4 text-primary" /> 即将到期提醒
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState
            icon={<CalendarClock className="size-5" />}
            title="暂时没有到期压力"
            description="有活跃订阅后，这里会提前展示续费提醒。"
            className="border-0 bg-transparent px-3 py-8"
          />
        ) : (
          <div className="space-y-2">
            {items.map(({ sub, daysLeft }) => (
              <div
                key={sub.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5 transition-colors hover:border-primary/15 hover:bg-primary/5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{sub.plan.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {getSubscriptionSubtitle(sub)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold tabular-nums">
                    {format(sub.endDate, "MM-dd HH:mm", { locale: zhCN })}
                  </p>
                  <StatusBadge tone={daysLeft <= 3 ? "warning" : "neutral"}>
                    {daysLeft} 天
                  </StatusBadge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function getSubscriptionSubtitle(sub: DashboardSubscription) {
  if (sub.plan.type === "PROXY") {
    return sub.nodeClient
      ? `${sub.nodeClient.inbound.protocol} · ${sub.nodeClient.inbound.tag}`
      : "代理套餐";
  }

  return sub.streamingSlot ? sub.streamingSlot.service.name : "流媒体套餐";
}
