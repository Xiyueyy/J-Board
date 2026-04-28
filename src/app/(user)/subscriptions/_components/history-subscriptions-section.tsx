import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Archive } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState, SectionHeader } from "@/components/shared/page-shell";
import {
  getSubscriptionStatusLabel,
  getSubscriptionStatusTone,
} from "../subscriptions-calculations";
import type { SubscriptionRecord } from "../subscriptions-types";

export function HistorySubscriptionsSection({
  subscriptions,
}: {
  subscriptions: SubscriptionRecord[];
}) {
  return (
    <section className="space-y-4">
      <SectionHeader title="历史记录" />
      {subscriptions.length === 0 ? (
        <EmptyState
          icon={<Archive className="size-5" />}
          title="历史记录还是空的"
          description="过期、暂停或取消后的订阅会在这里保留记录，方便你之后回看。"
        />
      ) : (
        <div className="space-y-2">
          {subscriptions.map((sub) => (
            <Card key={sub.id} className="border-muted-foreground/15">
              <CardContent className="py-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{sub.plan.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(sub.startDate, "yyyy-MM-dd", { locale: zhCN })} ~{" "}
                    {format(sub.endDate, "yyyy-MM-dd", { locale: zhCN })}
                  </p>
                </div>
                <StatusBadge tone={getSubscriptionStatusTone(sub.status)}>
                  {getSubscriptionStatusLabel(sub.status)}
                </StatusBadge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
