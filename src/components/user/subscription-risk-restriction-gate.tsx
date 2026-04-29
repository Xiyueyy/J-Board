"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, FileText, LifeBuoy } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export type SubscriptionRiskRestrictionNotice = {
  id: string;
  level: "WARNING" | "SUSPENDED";
  reasonLabel: string;
  message: string;
  riskReport: string | null;
  reportSentAt: string | null;
};

function supportHref(id: string) {
  return "/support?riskEventId=" + encodeURIComponent(id);
}

export function SubscriptionRiskRestrictionGate({
  restriction,
}: {
  restriction: SubscriptionRiskRestrictionNotice | null;
}) {
  const pathname = usePathname();

  if (!restriction) return null;

  const isSupportPath = pathname === "/support" || pathname.startsWith("/support/");

  if (isSupportPath) {
    return (
      <section className="mb-5 rounded-xl border border-destructive/25 bg-destructive/8 p-4 text-sm leading-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <AlertTriangle className="size-4" />
            </span>
            <div>
              <p className="font-semibold text-destructive">订阅风控限制处理中</p>
              <p className="mt-1 text-muted-foreground">
                请在工单中说明近期订阅访问来源。管理员解除前，其他用户中心操作会被临时限制。
              </p>
            </div>
          </div>
          <span className="rounded-full border border-destructive/20 px-2.5 py-1 text-xs font-medium text-destructive">
            {restriction.reasonLabel}
          </span>
        </div>
      </section>
    );
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-background/96 p-4 backdrop-blur-md">
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-destructive/25 bg-card shadow-2xl">
        <div className="border-b border-border/70 bg-destructive/8 p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                <AlertTriangle className="size-5" />
              </span>
              <div>
                <p className="text-xs font-medium text-destructive">订阅风控强制通知</p>
                <h2 className="mt-1 text-xl font-semibold tracking-[-0.02em]">账户操作已临时限制</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  系统检测到订阅链接出现异常地区或 IP 访问。管理员解除前，你只能新建工单联系客服完成核验。
                </p>
              </div>
            </div>
            <span className="w-fit rounded-full border border-destructive/20 px-3 py-1 text-xs font-medium text-destructive">
              {restriction.reasonLabel}
            </span>
          </div>
        </div>

        <div className="space-y-4 p-5 sm:p-6">
          <div className="rounded-xl border border-border/70 bg-muted/25 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <FileText className="size-4 text-primary" /> 风险摘要
            </div>
            <p className="text-sm leading-6 text-muted-foreground">{restriction.message}</p>
          </div>

          {restriction.riskReport && (
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl border border-border/70 bg-muted/30 p-4 text-xs leading-6 text-foreground">
              {restriction.riskReport}
            </pre>
          )}

          <div className="flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/8 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm leading-6">
              <p className="font-semibold text-primary">下一步</p>
              <p className="text-muted-foreground">新建工单说明访问来源、所在地区和是否共享过订阅链接。</p>
            </div>
            <Link href={supportHref(restriction.id)} className={buttonVariants({ size: "lg" })}>
              <LifeBuoy className="size-4" />
              新建工单联系客服
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
