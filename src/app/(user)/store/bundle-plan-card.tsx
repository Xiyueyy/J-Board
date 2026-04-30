"use client";

import { useState } from "react";
import { Film, Network, Package, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StorePlanHeader } from "./plan-card-parts";
import { PlanAvailabilityBadges } from "./plan-availability-badges";
import { BundleDetailDialog } from "./bundle-detail-dialog";
import type { BundlePlan } from "./bundle-plan-types";

interface Props {
  plan: BundlePlan;
}

export function BundlePlanCard({ plan }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const proxyCount = plan.items.filter((item) => item.type === "PROXY").length;
  const streamingCount = plan.items.filter((item) => item.type === "STREAMING").length;

  return (
    <>
      <article
        id={`plan-${plan.id}`}
        className="surface-card surface-lift group relative scroll-mt-24 flex flex-col overflow-hidden rounded-xl text-left"
      >
        <StorePlanHeader
          eyebrow={
            <span className="inline-flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
              <Package className="size-3.5" /> BUNDLE
            </span>
          }
          name={plan.name}
          meta={`${plan.items.length} 个子套餐 · ${plan.durationDays} 天`}
          price={`¥${plan.price.toFixed(0)}`}
          priceSuffix="/套"
        />

        <div className="relative px-6">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Network className="size-3.5 text-emerald-600" /> 代理节点
              </p>
              <p className="mt-1 text-sm font-medium">{proxyCount > 0 ? `${proxyCount} 个` : "未包含"}</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Film className="size-3.5 text-emerald-600" /> 流媒体
              </p>
              <p className="mt-1 text-sm font-medium">{streamingCount > 0 ? `${streamingCount} 个` : "未包含"}</p>
            </div>
          </div>
        </div>

        <div className="mt-auto space-y-4 px-6 pb-6 pt-4">
          <PlanAvailabilityBadges
            totalLimit={plan.totalLimit}
            perUserLimit={plan.perUserLimit}
            remainingCount={plan.remainingCount}
            isAvailable={plan.isAvailable}
            unavailableLabel="暂时售罄"
          />

          <Button
            type="button"
            className="w-full"
            size="lg"
            onClick={() => setDialogOpen(true)}
          >
            <Search className="size-4" />
            查看详情与购买
          </Button>
        </div>
      </article>

      <BundleDetailDialog open={dialogOpen} onOpenChange={setDialogOpen} plan={plan} />
    </>
  );
}
