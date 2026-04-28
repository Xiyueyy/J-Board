import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { NotificationBulkAction } from "./notification-actions";
import { NotificationList } from "./_components/notification-list";
import { getUserNotifications } from "./notifications-data";

export const metadata: Metadata = {
  title: "通知中心",
  description: "集中查看支付、订阅与系统通知。",
};

export default async function NotificationsPage() {
  const session = await getServerSession(authOptions);
  const { notifications, unreadCount, readCount } = await getUserNotifications(session!.user.id);

  return (
    <PageShell>
      <PageHeader
        eyebrow="消息中心"
        title="通知与提醒"
        actions={
          unreadCount > 0 || readCount > 0 ? (
            <NotificationBulkAction unreadCount={unreadCount} readCount={readCount} />
          ) : null
        }
      />

      <NotificationList notifications={notifications} unreadCount={unreadCount} />
    </PageShell>
  );
}
