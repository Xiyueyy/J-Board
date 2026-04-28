"use client";

import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function PaymentSuccessCard({ onDashboard }: { onDashboard: () => void }) {
  return (
    <Card className="rounded-xl p-1">
      <CardContent className="space-y-4 py-12 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-emerald-500/12 text-emerald-600">
          <CheckCircle2 className="size-6" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-display text-2xl font-semibold">支付成功</h1>
          <p className="mx-auto max-w-sm text-sm leading-6 text-muted-foreground">
            订单已自动处理。回到首页即可查看订阅、流量和到期提醒。
          </p>
        </div>
        <Button size="lg" onClick={onDashboard}>返回首页</Button>
      </CardContent>
    </Card>
  );
}
