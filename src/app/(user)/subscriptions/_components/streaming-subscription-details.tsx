import { Tv } from "lucide-react";
import type { SubscriptionRecord } from "../subscriptions-types";
import { StreamingCredentialCard } from "../streaming-credential-card";

export function StreamingSubscriptionDetails({ sub }: { sub: SubscriptionRecord }) {
  if (sub.plan.type !== "STREAMING") return null;

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Tv className="size-4 text-primary" /> 流媒体服务
        </div>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
          {sub.streamingSlot?.service.name ?? "待分配"}
        </span>
      </div>
      {sub.streamingSlot ? (
        <StreamingCredentialCard subscriptionId={sub.id} />
      ) : (
        <p className="text-sm leading-6 text-muted-foreground">服务账号正在分配中，请稍后刷新查看。</p>
      )}
    </div>
  );
}
