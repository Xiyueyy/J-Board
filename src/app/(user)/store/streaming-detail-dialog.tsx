"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Film, ShoppingCart } from "lucide-react";
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
import { purchaseStreaming } from "@/actions/user/purchase";
import { addStreamingPlanToCart } from "@/actions/user/cart";
import { StorePlanDescription } from "./plan-card-parts";
import { PlanAvailabilityBadges } from "./plan-availability-badges";
import { usePlanAvailabilityCheck } from "./use-plan-availability-check";
import type { StreamingPlan } from "./streaming-plan-types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: StreamingPlan;
}

export function StreamingDetailDialog({ open, onOpenChange, plan }: Props) {
  const [loading, setLoading] = useState(false);
  const [cartLoading, setCartLoading] = useState(false);
  const router = useRouter();
  const { checking, checkAvailability } = usePlanAvailabilityCheck(plan.id);

  async function handlePurchase() {
    setLoading(true);
    try {
      const orderId = await purchaseStreaming(plan.id);
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
      await addStreamingPlanToCart(plan.id);
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
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-500/15 bg-amber-500/10 px-2.5 py-1 text-[0.68rem] font-semibold tracking-[0.14em] text-amber-700 dark:text-amber-300">
            <Film className="size-3.5" /> STREAMING
          </div>
          <DialogTitle>{plan.name}</DialogTitle>
          <DialogDescription>
            {plan.serviceName ?? plan.name} · {plan.durationDays}天 · ¥{plan.price.toFixed(0)}/{plan.durationDays}天
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto -mx-6 px-6 space-y-5">
          {plan.description && (
            <div>
              <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-muted-foreground">
                服务说明
              </p>
              <StorePlanDescription description={plan.description} />
            </div>
          )}

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
              disabled={cartLoading || !plan.isAvailable}
            >
              <ShoppingCart className="size-4" />
              {cartLoading ? "正在加入..." : "加入购物车"}
            </Button>
            <Button
              size="lg"
              onClick={handlePurchase}
              disabled={loading || !plan.isAvailable}
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
