"use client";

import { CheckCircle2, Coins, CreditCard, QrCode } from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PaymentPageStatus, PaymentProvider } from "../payment-types";

interface PaymentMethodSelectorProps {
  providers: PaymentProvider[];
  selectedIdx: number;
  selectedProvider: PaymentProvider | null;
  status: PaymentPageStatus;
  onSelect: (index: number) => void;
  onStartPayment: () => void;
}

export function PaymentMethodSelector({
  providers,
  selectedIdx,
  selectedProvider,
  status,
  onSelect,
  onStartPayment,
}: PaymentMethodSelectorProps) {
  return (
    <>
      <div className="grid gap-3">
        {providers.map((provider, index) => {
          const selected = selectedIdx === index;
          return (
            <button
              key={`${provider.provider}-${provider.channel ?? ""}`}
              type="button"
              onClick={() => onSelect(index)}
              className={cn(
                "group flex items-center justify-between gap-4 rounded-lg border p-3 text-left transition-colors",
                selected
                  ? "border-primary/25 bg-primary/8"
                  : "border-border bg-muted/20 hover:border-primary/15 hover:bg-card",
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn("flex size-9 items-center justify-center rounded-lg transition-colors duration-200", selected ? "bg-primary text-primary-foreground" : "bg-muted text-primary")}>
                  {provider.provider === "usdt_trc20" ? (
                    <Coins className="size-5" />
                  ) : provider.provider === "manual_qr" ? (
                    <QrCode className="size-5" />
                  ) : (
                    <CreditCard className="size-5" />
                  )}
                </div>
                <div>
                  <span className="font-semibold">{provider.name}</span>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {provider.provider === "usdt_trc20"
                      ? "适合使用稳定币付款"
                      : provider.provider === "manual_qr"
                        ? "扫码后点击我已付款即可开通"
                        : "根据页面提示完成确认"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {provider.provider === "usdt_trc20" && <StatusBadge tone="info">Crypto</StatusBadge>}
                {selected && <CheckCircle2 className="size-5 text-primary" />}
              </div>
            </button>
          );
        })}
      </div>

      <Button
        size="lg"
        className="w-full"
        disabled={!selectedProvider || status === "creating"}
        onClick={onStartPayment}
      >
        {status === "creating" ? "正在准备支付..." : "继续支付"}
      </Button>
    </>
  );
}
