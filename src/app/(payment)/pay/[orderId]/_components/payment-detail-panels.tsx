"use client";

import { QRCodeSVG } from "qrcode.react";
import { CheckCircle2 } from "lucide-react";
import { CopyButton } from "@/components/shared/copy-button";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import type { PaymentInfo } from "../payment-types";

export function AlipayQrView({ qrCode }: { qrCode: string }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-muted/20 p-4">
      <p className="font-medium">请使用支付宝扫码支付</p>
      <div className="rounded-xl border border-border bg-white p-4">
        <QRCodeSVG value={qrCode} size={220} />
      </div>
      <CopyButton text={qrCode} />
    </div>
  );
}

export function UsdtView({ raw }: { raw: NonNullable<PaymentInfo["raw"]> }) {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-primary/15 bg-primary/10 p-4 text-center">
        <p className="text-xs font-medium tracking-wide text-primary/75">USDT 转账 · TRC20</p>
        <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-primary tabular-nums">
          {raw.usdtAmount} USDT
        </p>
        <p className="mt-1 text-sm text-muted-foreground">请务必转账精确金额，系统自动匹配确认</p>
      </div>

      <div className="space-y-3 rounded-xl border border-border bg-muted/25 p-4 text-sm">
        <div className="flex items-start justify-between gap-4">
          <span className="shrink-0 text-muted-foreground">收款地址</span>
          <div className="flex min-w-0 items-center gap-2">
            <code className="truncate rounded-full bg-background/70 px-2 py-1 text-xs">
              {raw.walletAddress?.slice(0, 10)}...{raw.walletAddress?.slice(-6)}
            </code>
            <CopyButton text={raw.walletAddress || ""} />
          </div>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">网络</span>
          <StatusBadge tone="neutral">{raw.network}</StatusBadge>
        </div>
        {raw.exchangeRate && (
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">汇率</span>
            <span className="font-medium">1 USDT = ¥{raw.exchangeRate}</span>
          </div>
        )}
      </div>

      <div className="flex justify-center">
        <div className="rounded-xl border border-border bg-white p-4">
          <QRCodeSVG value={raw.walletAddress || ""} size={220} />
        </div>
      </div>
    </div>
  );
}


export function ManualQrView({
  raw,
  confirming,
  submitted,
  onConfirm,
}: {
  raw: NonNullable<PaymentInfo["raw"]>;
  confirming?: boolean;
  submitted?: boolean;
  onConfirm: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-primary/15 bg-primary/10 p-4 text-center">
        <p className="text-xs font-medium tracking-wide text-primary/75">扫码付款</p>
        <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-primary tabular-nums">
          {raw.cnyAmount ? `¥${raw.cnyAmount}` : "按订单金额付款"}
        </p>
        {raw.subject && (
          <p className="mt-1 text-xs text-muted-foreground">{raw.subject}</p>
        )}
      </div>

      <div className="flex justify-center">
        <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={raw.qrCodeImage} alt="收款码" className="size-64 max-w-full rounded-xl object-contain" />
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-border bg-muted/25 p-4 text-sm leading-6 text-muted-foreground">
        <p className="font-medium text-foreground">付款说明</p>
        <p className="whitespace-pre-line">
          {raw.instructions || "请扫码完成付款，付款后点击“我已付款”。管理员确认到账后会为你开通。"}
        </p>
      </div>

      {submitted ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-700 dark:text-amber-300">
          <p className="font-semibold">已提交付款审核</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            管理员已收到通知，确认到账后会在后台为你开通。
          </p>
        </div>
      ) : (
        <>
          <Button type="button" size="lg" className="w-full" disabled={confirming} onClick={onConfirm}>
            <CheckCircle2 className="size-4" />
            {confirming ? "正在提交审核..." : "我已付款"}
          </Button>
          <p className="text-center text-xs leading-5 text-muted-foreground">
            点击后订单会进入待审核，管理员确认到账后才会开通。
          </p>
        </>
      )}
    </div>
  );
}
