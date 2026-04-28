"use client";

import Link from "next/link";
import { Clock3, ShoppingBag } from "lucide-react";
import { cancelOwnPendingOrder } from "@/actions/user/orders";
import { ConfirmActionButton } from "@/components/shared/confirm-action-button";
import { buttonVariants } from "@/components/ui/button";

interface PendingStoreOrder {
  id: string;
  amount: number;
  planName: string;
  createdAt: string;
}

export function PendingOrderBanner({ order }: { order: PendingStoreOrder | null }) {
  if (!order) return null;

  return (
    <section className="surface-card overflow-hidden rounded-xl p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300">
            <Clock3 className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">你有一笔订单正在等待支付</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {order.planName} · ¥{order.amount.toFixed(2)}。完成或取消后，才能开启新的购买。
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link href={`/pay/${order.id}`} className={buttonVariants({ size: "lg" })}>
            <ShoppingBag className="size-4" />
            继续支付
          </Link>
          <ConfirmActionButton
            variant="outline"
            size="lg"
            title="取消这笔订单？"
            description="取消后会释放本次占用的名额，你可以重新选择套餐或支付方式。"
            confirmLabel="取消订单"
            successMessage="订单已取消"
            errorMessage="取消订单失败"
            onConfirm={() => cancelOwnPendingOrder(order.id)}
          >
            取消后重选
          </ConfirmActionButton>
        </div>
      </div>
    </section>
  );
}
