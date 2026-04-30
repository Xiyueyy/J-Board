"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { RefreshCw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { ConfirmActionButton } from "@/components/shared/confirm-action-button";
import { Button, buttonVariants } from "@/components/ui/button";
import { PaymentMethodSelector } from "./_components/payment-method-selector";
import { AlipayQrView, ManualQrView, UsdtView } from "./_components/payment-detail-panels";
import { PaymentCard, PaymentFrame } from "./_components/payment-frame";
import { PaymentSuccessCard } from "./_components/payment-success-card";
import { usePaymentFlow } from "./use-payment-flow";

export function PayPageClient({ orderId }: { orderId: string }) {
  const router = useRouter();
  const {
    providers,
    selectedIdx,
    setSelectedIdx,
    selectedProvider,
    payment,
    status,
    pageError,
    manualConfirming,
    startSelectedPayment,
    confirmManualPayment,
    resetPaymentChoice,
    cancelOrder,
  } = usePaymentFlow(orderId);

  if (status === "paid") {
    return (
      <PaymentFrame>
        <PaymentSuccessCard onDashboard={() => router.push("/dashboard")} />
      </PaymentFrame>
    );
  }

  return (
    <PaymentFrame>
      <PaymentCard title={payment ? "等待支付完成" : "选择支付方式"}>
        {pageError && (
          <div className="rounded-lg border border-destructive/15 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
            {pageError}
          </div>
        )}

        {status === "booting" && (
          <p className="py-4 text-center text-sm text-muted-foreground">正在读取订单状态…</p>
        )}

        {status !== "booting" && providers.length === 0 && (
          <p className="py-4 text-center text-muted-foreground">现在没有可用的支付方式，请稍后再试或联系支持。</p>
        )}

        {!payment && status !== "booting" && providers.length > 0 && (
          <PaymentMethodSelector
            providers={providers}
            selectedIdx={selectedIdx}
            selectedProvider={selectedProvider}
            status={status}
            onSelect={setSelectedIdx}
            onStartPayment={startSelectedPayment}
          />
        )}

        {payment && selectedProvider?.provider === "alipay_f2f" && payment.qrCode && (
          <AlipayQrView qrCode={payment.qrCode} />
        )}

        {payment && selectedProvider?.provider === "usdt_trc20" && payment.raw && (
          <UsdtView raw={payment.raw} />
        )}

        {payment && selectedProvider?.provider === "manual_qr" && payment.raw && (
          <ManualQrView
            raw={payment.raw}
            confirming={manualConfirming}
            submitted={status === "reviewing"}
            onConfirm={confirmManualPayment}
          />
        )}

        {payment && status === "waiting" && selectedProvider?.provider !== "manual_qr" && (
          <div className="space-y-3 rounded-lg border border-primary/15 bg-primary/10 px-4 py-3 text-center text-sm text-primary">
            <p className="animate-pulse font-semibold">正在等待支付结果返回</p>
            <p className="text-xs leading-5 text-muted-foreground">你可以保持页面打开；如果想换一种方式支付，请先重选支付方式。</p>
          </div>
        )}

        {status === "reviewing" && (
          <Link href="/dashboard" className={buttonVariants({ size: "lg", variant: "outline", className: "w-full" })}>
            返回仪表盘
          </Link>
        )}

        {status !== "booting" && status !== "reviewing" && (
          <div className="grid gap-2 sm:grid-cols-2">
            {payment ? (
              <Button
                type="button"
                size="lg"
                variant="outline"
                onClick={() => {
                  void resetPaymentChoice().then(() => toast.success("已回到支付方式选择"));
                }}
              >
                <RefreshCw className="size-4" />
                重选支付方式
              </Button>
            ) : (
              <Link href="/store" className={buttonVariants({ size: "lg", variant: "outline" })}>
                返回商店
              </Link>
            )}
            <ConfirmActionButton
              size="lg"
              variant="destructive"
              title="取消这笔订单？"
              description="取消后会释放本次保留的名额，你可以重新选择套餐并创建新的订单。"
              confirmLabel="取消订单"
              successMessage="订单已取消"
              errorMessage="取消订单失败"
              onConfirm={cancelOrder}
            >
              <XCircle className="size-4" />
              取消订单
            </ConfirmActionButton>
          </div>
        )}
      </PaymentCard>
    </PaymentFrame>
  );
}
