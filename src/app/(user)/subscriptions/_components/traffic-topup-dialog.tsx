"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { purchaseTrafficTopup } from "@/actions/user/purchase";
import { getErrorMessage } from "@/lib/errors";

interface TrafficTopupConfig {
  topupPricingMode: string;
  topupPricePerGb: number | null;
  topupFixedPrice: number | null;
  minTopupGb: number | null;
  maxTopupGb: number | null;
}

interface TrafficTopupDialogProps {
  subscriptionId: string;
  trafficPoolRemainingGb: number | null;
  config: TrafficTopupConfig;
}

function getTopupBounds(trafficPoolRemainingGb: number | null, config: TrafficTopupConfig) {
  const min = Math.max(1, config.minTopupGb ?? 1);
  const configuredMax = config.maxTopupGb ?? 1000;
  const poolMax = trafficPoolRemainingGb == null
    ? configuredMax
    : Math.max(0, Math.floor(trafficPoolRemainingGb));
  const max = Math.max(0, Math.min(configuredMax, poolMax));
  return { min, max };
}

export function TrafficTopupDialog({
  subscriptionId,
  trafficPoolRemainingGb,
  config,
}: TrafficTopupDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const { min, max } = getTopupBounds(trafficPoolRemainingGb, config);
  const initialTopupGb = useMemo(() => {
    if (max <= 0) return min;
    return Math.min(Math.max(min, 10), max);
  }, [max, min]);
  const [topupGb, setTopupGb] = useState(initialTopupGb);
  const isFixedAmount = config.topupPricingMode === "FIXED_AMOUNT";
  const totalPrice = useMemo(() => {
    const amount = isFixedAmount
      ? (config.topupFixedPrice ?? 0)
      : (config.topupPricePerGb ?? 0) * topupGb;
    return amount.toFixed(2);
  }, [config.topupFixedPrice, config.topupPricePerGb, isFixedAmount, topupGb]);
  const hasPrice = isFixedAmount
    ? (config.topupFixedPrice ?? 0) > 0
    : (config.topupPricePerGb ?? 0) > 0;
  const disabled = max <= 0 || max < min || !hasPrice;

  async function handleTopup() {
    if (disabled) {
      toast.error(hasPrice ? "当前套餐剩余额度不足，暂不可增流量" : "这款套餐暂未配置增流量价格");
      return;
    }

    setLoading(true);
    try {
      const orderId = await purchaseTrafficTopup(subscriptionId, topupGb);
      router.push(`/pay/${orderId}`);
    } catch (error) {
      toast.error(getErrorMessage(error, "创建增流量订单失败"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        size="sm"
        onClick={() => {
          setTopupGb(initialTopupGb);
          setOpen(true);
        }}
        disabled={disabled}
        className="flex-1 sm:flex-none"
      >
        <Plus className="size-3.5" />
        增加流量
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="mb-1 inline-flex w-fit items-center gap-2 rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-xs font-semibold tracking-[0.14em] text-primary">
              <WalletCards className="size-3.5" /> TRAFFIC TOPUP
            </div>
            <DialogTitle>增加订阅流量</DialogTitle>
            <DialogDescription>
              选择本次增加的流量，支付完成后自动写入当前订阅。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">单次可增范围</span>
                <span className="font-semibold tabular-nums">{disabled ? "暂无额度" : `${min}-${max} GB`}</span>
              </div>
            </div>
            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <div className="mb-4 flex justify-between text-sm">
                <span className="font-medium">本次增量</span>
                <span className="font-semibold text-primary tabular-nums">{topupGb} GB</span>
              </div>
              <Slider
                value={[topupGb]}
                onValueChange={(values: number | readonly number[]) => {
                  const value = Array.isArray(values) ? values[0] : values;
                  setTopupGb(value ?? min);
                }}
                min={min}
                max={Math.max(min, max)}
                step={1}
                disabled={disabled}
              />
              <p className="mt-3 text-xs text-muted-foreground">
                {isFixedAmount
                  ? `固定金额 ¥${(config.topupFixedPrice ?? 0).toFixed(2)}`
                  : `按 ¥${(config.topupPricePerGb ?? 0).toFixed(2)}/GB 计费`}
              </p>
            </div>
            <div className="rounded-lg border border-primary/15 bg-primary/10 p-4">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-medium">本次应付</span>
                <span className="text-3xl font-semibold tracking-[-0.06em] text-primary tabular-nums">¥{totalPrice}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              size="lg"
              className="w-full sm:w-auto"
              onClick={handleTopup}
              disabled={loading || disabled}
            >
              {loading ? "创建中..." : "去支付"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
