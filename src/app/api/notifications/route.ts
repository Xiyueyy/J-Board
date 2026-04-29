import { getActiveSession } from "@/lib/require-auth";
import { jsonError, jsonOk } from "@/lib/api-response";
import { getUserNotifications } from "@/app/(user)/notifications/notifications-data";

export async function GET() {
  const session = await getActiveSession();
  if (!session) return jsonError("未登录", { status: 401 });

  const data = await getUserNotifications(session.user.id);
  return jsonOk({
    notifications: data.notifications.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      level: n.level,
      isRead: n.isRead,
      link: n.link,
      createdAt: n.createdAt.toISOString(),
    })),
    unreadCount: data.unreadCount,
    readCount: data.readCount,
  });
}
