import Link from "next/link";
import type { UserNotification } from "@prisma/client";
import { StatusBadge } from "@/components/shared/status-badge";
import { cn, formatDate } from "@/lib/utils";
import { NotificationActions } from "../notification-actions";
import {
  getNotificationLevelTone,
  getNotificationReadLabel,
  getNotificationReadTone,
  notificationLevelLabels,
} from "../notifications-calculations";

interface NotificationItemProps {
  notification: UserNotification;
}

export function NotificationItem({ notification }: NotificationItemProps) {
  return (
    <article
      className={cn(
        "rounded-2xl border border-border/50 bg-muted/25 p-4 transition-colors hover:bg-muted/45",
        !notification.isRead && "border-primary/20 bg-primary/[0.04]",
      )}
    >
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
        <div className="min-w-0 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium tracking-tight text-foreground">{notification.title}</h3>
            <StatusBadge tone={getNotificationReadTone(notification.isRead)}>
              {getNotificationReadLabel(notification.isRead)}
            </StatusBadge>
            <StatusBadge tone={getNotificationLevelTone(notification.level)}>
              {notificationLevelLabels[notification.level]}
            </StatusBadge>
          </div>
          <p className="whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
            {notification.body}
          </p>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <time dateTime={notification.createdAt.toISOString()}>
              {formatDate(notification.createdAt)}
            </time>
            {notification.link && (
              <Link href={notification.link} className="font-medium text-primary hover:underline">
                前往查看
              </Link>
            )}
          </div>
        </div>
        <NotificationActions notificationId={notification.id} isRead={notification.isRead} />
      </div>
    </article>
  );
}
