import type { UserNotification } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface UserNotificationsData {
  notifications: UserNotification[];
  unreadCount: number;
  readCount: number;
}

export async function getUserNotifications(userId: string): Promise<UserNotificationsData> {
  const notifications = await prisma.userNotification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const unreadCount = notifications.filter((notification) => !notification.isRead).length;
  const readCount = notifications.length - unreadCount;

  return { notifications, unreadCount, readCount };
}


export async function getUnreadNotificationCount(userId: string): Promise<number> {
  return prisma.userNotification.count({
    where: { userId, isRead: false },
  });
}
