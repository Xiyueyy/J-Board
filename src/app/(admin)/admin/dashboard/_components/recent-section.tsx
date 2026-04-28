import { ReceiptText, UserRound } from "lucide-react";
import { EmptyState } from "@/components/shared/page-shell";
import { OrderStatusBadge } from "@/components/shared/domain-badges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateShort } from "@/lib/utils";
import type { RecentAdminOrder, RecentAdminUser } from "../dashboard-data";

interface RecentSectionProps {
  recentOrders: RecentAdminOrder[];
  recentUsers: RecentAdminUser[];
}

export function RecentSection({ recentOrders, recentUsers }: RecentSectionProps) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ReceiptText className="size-4 text-primary" /> 最近订单
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentOrders.length === 0 ? (
            <EmptyState
              title="还没有订单"
              description="用户创建订单后，这里会显示最新购买和支付状态。"
              className="border-0 bg-transparent py-8"
            />
          ) : (
            <div className="space-y-2">
              {recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3 transition-colors duration-200 hover:border-primary/20 hover:bg-primary/7"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{order.plan.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {order.user.email} · {formatDateShort(order.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums">
                      ¥{Number(order.amount).toFixed(2)}
                    </span>
                    <OrderStatusBadge status={order.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserRound className="size-4 text-primary" /> 最近注册
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentUsers.length === 0 ? (
            <EmptyState
              title="还没有新用户"
              description="新用户注册后，这里会显示最近加入的账户。"
              className="border-0 bg-transparent py-8"
            />
          ) : (
            <div className="space-y-2">
              {recentUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3 transition-colors duration-200 hover:border-primary/20 hover:bg-primary/7"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {user.name || user.email}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-background px-2.5 py-1 text-xs text-muted-foreground">
                    {formatDateShort(user.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function RecentSectionSkeleton() {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {[0, 1].map((i) => (
        <Card key={i}>
          <CardHeader>
            <div className="h-5 w-20 animate-pulse rounded bg-muted" />
          </CardHeader>
          <CardContent className="space-y-2">
            {[0, 1, 2].map((j) => (
              <div
                key={j}
                className="h-14 animate-pulse rounded-[1.15rem] bg-muted/30"
              />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
