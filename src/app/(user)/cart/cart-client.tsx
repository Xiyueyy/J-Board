"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Gift, ShoppingCart, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/shared/status-badge";
import { getErrorMessage } from "@/lib/errors";
import { checkoutCart, clearCart, removeCartItem } from "@/actions/user/cart";

interface CartItemView {
  id: string;
  name: string;
  type: "PROXY" | "STREAMING" | "BUNDLE";
  categoryName: string;
  description: string | null;
  durationDays: number;
  amount: number;
  priceLabel: string;
  trafficGb: number | null;
  nodeName: string | null;
  serviceName: string | null;
  inboundName: string;
  bundleSummary: string | null;
}

interface CouponView {
  id: string;
  code: string;
  name: string;
  description: string | null;
  private: boolean;
  thresholdAmount: number | null;
  discountType: "AMOUNT_OFF" | "PERCENT_OFF";
  discountValue: number;
}

interface PromotionView {
  id: string;
  name: string;
  thresholdAmount: number;
  discountAmount: number;
}

function getCartItemTone(type: CartItemView["type"]) {
  if (type === "PROXY") return "info";
  if (type === "BUNDLE") return "success";
  return "warning";
}

function getCartItemTypeLabel(type: CartItemView["type"]) {
  if (type === "PROXY") return "代理";
  if (type === "BUNDLE") return "聚合";
  return "流媒体";
}

function getCartItemMeta(item: CartItemView) {
  if (item.type === "PROXY") {
    return `${item.nodeName ?? "优选区域"} · ${item.inboundName} · ${item.priceLabel}`;
  }
  if (item.type === "BUNDLE") {
    return `${item.bundleSummary || "多个子套餐"} · ${item.priceLabel}`;
  }
  return `${item.serviceName ?? "精选服务"} · ${item.priceLabel}`;
}

export function CartClient({
  items,
  subtotal,
  coupons,
  promotions,
}: {
  items: CartItemView[];
  subtotal: number;
  coupons: CouponView[];
  promotions: PromotionView[];
}) {
  const router = useRouter();
  const [couponCode, setCouponCode] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);

  const bestPromotion = useMemo(
    () => promotions.filter((rule) => subtotal >= rule.thresholdAmount).sort((a, b) => b.discountAmount - a.discountAmount)[0] ?? null,
    [promotions, subtotal],
  );

  async function handleRemove(itemId: string) {
    setLoadingId(itemId);
    try {
      await removeCartItem(itemId);
      toast.success("已移出购物车");
      router.refresh();
    } catch (error) {
      toast.error(getErrorMessage(error, "移出失败"));
    } finally {
      setLoadingId(null);
    }
  }

  async function handleClear() {
    setLoadingId("clear");
    try {
      await clearCart();
      toast.success("购物车已清空");
      router.refresh();
    } catch (error) {
      toast.error(getErrorMessage(error, "清空失败"));
    } finally {
      setLoadingId(null);
    }
  }

  async function handleCheckout() {
    setCheckingOut(true);
    try {
      const orderId = await checkoutCart(couponCode);
      toast.success("订单已为你保留");
      router.push(`/pay/${orderId}`);
    } catch (error) {
      toast.error(getErrorMessage(error, "结算失败"));
    } finally {
      setCheckingOut(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="space-y-4">
        {items.map((item) => (
          <article key={item.id} className="surface-card surface-lift overflow-hidden rounded-xl p-4">
            <div className="liquid-orb -right-10 -top-14 size-28 bg-primary/12" />
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone={getCartItemTone(item.type)}>
                    {getCartItemTypeLabel(item.type)}
                  </StatusBadge>
                  <StatusBadge>{item.categoryName}</StatusBadge>
                  <StatusBadge>{item.durationDays} 天</StatusBadge>
                </div>
                <div>
                  <h3 className="text-xl font-semibold tracking-[-0.04em]">{item.name}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground text-pretty">
                    {getCartItemMeta(item)}
                  </p>
                </div>
                {item.description && (
                  <p className="max-w-2xl text-sm leading-6 text-muted-foreground text-pretty">{item.description}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center justify-between gap-3 lg:flex-col lg:items-end">
                <p className="text-3xl font-semibold tracking-[-0.06em] text-primary tabular-nums">
                  ¥{item.amount.toFixed(2)}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void handleRemove(item.id)}
                  disabled={loadingId === item.id}
                >
                  <Trash2 className="size-4" />
                  移出
                </Button>
              </div>
            </div>
          </article>
        ))}
      </section>

      <aside className="surface-card sticky top-24 h-fit space-y-4 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ShoppingCart className="size-4" />
          </span>
          <div>
            <h2 className="font-semibold">确认购买清单</h2>
            <p className="text-xs text-muted-foreground">结算后会生成一笔待支付订单。</p>
          </div>
        </div>

        <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">商品小计</span>
            <span className="font-semibold tabular-nums">¥{subtotal.toFixed(2)}</span>
          </div>
          {bestPromotion && (
            <div className="flex justify-between gap-3 text-primary">
              <span>自动满减 · {bestPromotion.name}</span>
              <span className="font-semibold tabular-nums">-¥{bestPromotion.discountAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="border-t border-border/45 pt-3">
            <p className="text-xs leading-5 text-muted-foreground">最终金额以支付页订单为准。</p>
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="couponCode" className="flex items-center gap-2 text-sm font-semibold">
            <Gift className="size-4 text-primary" /> 优惠券
          </label>
          <div className="flex gap-2">
            <Input
              id="couponCode"
              value={couponCode}
              onChange={(event) => setCouponCode(event.target.value)}
              placeholder="输入优惠码"
            />
            {couponCode && (
              <Button type="button" variant="outline" size="icon" onClick={() => setCouponCode("")} aria-label="清空优惠码">
                <X className="size-4" />
              </Button>
            )}
          </div>
          {coupons.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {coupons.slice(0, 4).map((coupon) => (
                <button
                  key={`${coupon.id}-${coupon.private ? "private" : "public"}`}
                  type="button"
                  className="rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary transition hover:-translate-y-0.5"
                  onClick={() => setCouponCode(coupon.code)}
                >
                  {coupon.code}
                </button>
              ))}
            </div>
          )}
        </div>

        {promotions.length > 0 && (
          <div className="space-y-2 rounded-lg border border-amber-500/15 bg-amber-500/10 p-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-300">
              <Sparkles className="size-4" /> 当前满减
            </p>
            {promotions.map((rule) => (
              <p key={rule.id} className="text-xs leading-5 text-muted-foreground">
                满 ¥{rule.thresholdAmount.toFixed(2)} 减 ¥{rule.discountAmount.toFixed(2)} · {rule.name}
              </p>
            ))}
          </div>
        )}

        <div className="grid gap-2">
          <Button size="lg" onClick={() => void handleCheckout()} disabled={checkingOut || items.length === 0}>
            {checkingOut ? "正在整理订单..." : "结算并去支付"}
            <ArrowRight className="size-4" />
          </Button>
          <Button type="button" variant="outline" size="lg" onClick={() => void handleClear()} disabled={loadingId === "clear"}>
            清空购物车
          </Button>
        </div>
      </aside>
    </div>
  );
}
