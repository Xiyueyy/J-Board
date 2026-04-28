import type { AuditLog } from "@prisma/client";
import { SubscriptionTimeline } from "@/components/shared/subscription-timeline";
import { formatDate } from "@/lib/utils";

export function SubscriptionTimelineSection({ logs }: { logs: AuditLog[] }) {
  return (
    <section className="surface-card rounded-xl p-5">
      <div className="mb-4">
        <h3 className="text-lg font-semibold tracking-[-0.02em]">事件时间线</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">记录订阅创建、续费、暂停和系统操作。</p>
      </div>
      <SubscriptionTimeline
        items={logs.map((item) => ({
          id: item.id,
          action: item.action,
          message: item.message,
          createdAt: formatDate(item.createdAt),
          actorEmail: item.actorEmail,
        }))}
      />
    </section>
  );
}
