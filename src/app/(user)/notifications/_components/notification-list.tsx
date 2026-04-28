import Link from "next/link";
import type { UserNotification } from "@prisma/client";
import { Bell } from "lucide-react";
import { EmptyState } from "@/components/shared/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { NotificationItem } from "./notification-item";

interface NotificationListProps {
  notifications: UserNotification[];
  unreadCount: number;
}

export function NotificationList({ notifications, unreadCount }: NotificationListProps) {
  return (
    <Card className="rounded-2xl">
      <CardHeader className="border-b border-border/50">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          全部消息
          <span className="text-sm font-normal text-muted-foreground">未读 {unreadCount}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {notifications.length === 0 ? (
          <EmptyState
            icon={<Bell className="size-5" />}
            title="现在很安静"
            description="支付结果、订阅状态和系统提醒会集中出现在这里。"
            action={
              <Link href="/store" className={buttonVariants({ variant: "outline" })}>
                浏览套餐
              </Link>
            }
            className="border-0 bg-transparent py-10"
          />
        ) : (
          <div role="list" className="space-y-3">
            {notifications.map((notification) => (
              <div key={notification.id} role="listitem">
                <NotificationItem notification={notification} />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
