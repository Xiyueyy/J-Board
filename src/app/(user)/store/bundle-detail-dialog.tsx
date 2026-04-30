"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Film, Network, Package, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { purchaseBundle } from "@/actions/user/purchase";
import { addBundlePlanToCart } from "@/actions/user/cart";
import { StorePlanDescription } from "./plan-card-parts";
import { PlanAvailabilityBadges } from "./plan-availability-badges";
import { usePlanAvailabilityCheck } from "./use-plan-availability-check";
import type { BundlePlan } from "./bundle-plan-types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: BundlePlan;
}

export function BundleDetailDialog({ open, onOpenChange, plan }: Props) {
  const [loading, setLoading] = useState(false);
  const [cartLoading, setCartLoading] = useState(false);
  const router = useRouter();
  const { checking, checkAvailability } = usePlanAvailabilityCheck(plan.id);

  async function handlePurchase() {
    setLoading(true);
    try {
      const orderId = await purchaseBundle(plan.id);
      router.push(`/pay/${orderId}`);
    } catch (error) {
      toast.error(getErrorMessage(error, "下单失败"));
    } finally {
      setLoading(false);
    }
  }

  async function handleAddToCart() {
    setCartLoading(true);
    try {
      await addBundlePlanToCart(plan.id);
      toast.success("已加入购物车");
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      toast.error(getErrorMessage(error, "加入购物车失败"));
    } finally {
      setCartLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-500/15 bg-emerald-500/10 px-2.5 py-1 text-[0.68rem] font-semibold tracking-[0.14em] text-emerald-700 dark:text-emerald-300">
            <Package className="size-3.5" /> BUNDLE
          </div>
          <DialogTitle>{plan.name}</DialogTitle>
          <DialogDescription>
            {plan.items.length} 个子套餐 · {plan.durationDays} 天 · ¥{plan.price.toFixed(2)}/套
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto -mx-6 px-6 space-y-5">
          {plan.description && (
            <div>
              <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-muted-foreground">
                套餐说明
              </p>
              <StorePlanDescription description={plan.description} />
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-muted-foreground">
              打包内容
            </p>
            <div className="space-y-2">
              {plan.items.map((item) => (
                <div key={item.id} className="rounded-xl border border-border bg-muted/25 px-3 py-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-semibold">
                        {item.type === "PROXY" ? (
                          <Network className="size-4 text-primary" />
                        ) : (
                          <Film className="size-4 text-amber-600" />
                        )}
                        <span className="truncate">{item.name}</span>
                      </p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {item.type === "PROXY"
                          ? `${item.nodeName ?? "优选节点"} · ${item.inboundName ?? "优选线路"} · ${item.trafficGb ?? 0} GB`
                          : `${item.serviceName ?? "精选流媒体"} · ${item.durationDays} 天`}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                      {item.type === "PROXY" ? "代理" : "流媒体"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-muted-foreground">
              库存状态
            </p>
            <PlanAvailabilityBadges
              totalLimit={plan.totalLimit}
              perUserLimit={plan.perUserLimit}
              remainingCount={plan.remainingCount}
              isAvailable={plan.isAvailable}
              unavailableLabel="暂时售罄"
            />
          </div>

          {!plan.isAvailable && (
            <p className="rounded-[1rem] border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs leading-5 text-destructive">
              当前名额已满{plan.nextAvailableAt ? `，预计 ${plan.nextAvailableAt} 后可能补位` : ""}
            </p>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              size="lg"
              variant="outline"
              onClick={handleAddToCart}
              disabled={cartLoading || !plan.isAvailable || plan.items.length === 0}
            >
              <ShoppingCart className="size-4" />
              {cartLoading ? "正在加入..." : "加入购物车"}
            </Button>
            <Button
              size="lg"
              onClick={handlePurchase}
              disabled={loading || !plan.isAvailable || plan.items.length === 0}
            >
              {loading ? "正在保留..." : "立即支付"}
            </Button>
          </div>

          {!plan.isAvailable && (
            <Button
              size="lg"
              variant="outline"
              className="w-full"
              onClick={checkAvailability}
              disabled={checking}
            >
              {checking ? "查询中..." : "查看补位时间"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
