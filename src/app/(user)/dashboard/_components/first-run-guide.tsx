import Link from "next/link";
import { ArrowRight, CircleCheck, LifeBuoy, ShoppingBag } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FirstRunGuideProps {
  pendingOrderCount: number;
}

const steps = [
  {
    title: "选择套餐",
    description: "从商店挑选代理或流媒体套餐。",
  },
  {
    title: "完成支付",
    description: "支付成功后自动开通订阅。",
  },
  {
    title: "导入使用",
    description: "复制订阅链接或扫码导入客户端。",
  },
];

export function FirstRunGuide({ pendingOrderCount }: FirstRunGuideProps) {
  const hasPendingOrder = pendingOrderCount > 0;

  return (
    <section className="surface-card overflow-hidden rounded-xl p-5 sm:p-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr] lg:items-center">
        <div className="space-y-4">
          <p className="text-xs font-medium tracking-wide text-muted-foreground">
            新用户指引
          </p>
          <div className="space-y-2">
            <h2 className="text-display text-2xl font-semibold text-balance sm:text-3xl">
              快速开始
            </h2>
            <p className="max-w-lg text-sm leading-6 text-muted-foreground text-pretty">
              完成「选套餐、支付、拿订阅」三步即可开始使用。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={hasPendingOrder ? "/orders" : "/store"}
              className={buttonVariants({ size: "lg" })}
            >
              {hasPendingOrder ? "继续支付订单" : "去商店选择套餐"}
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/support"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              <LifeBuoy className="size-4" />
              需要帮助
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-muted/30 p-3">
          <div className="space-y-2">
            {steps.map((step, index) => (
              <div
                key={step.title}
                className={cn(
                  "group flex gap-3 rounded-lg border px-3 py-3 transition-colors",
                  index === 1 && hasPendingOrder
                    ? "border-primary/20 bg-primary/8"
                    : "border-border/50 bg-card",
                )}
              >
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  {index === 0 ? (
                    <ShoppingBag className="size-3.5" />
                  ) : (
                    <CircleCheck className="size-3.5" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{step.title}</p>
                  <p className="mt-0.5 text-xs leading-5 text-muted-foreground text-pretty">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
