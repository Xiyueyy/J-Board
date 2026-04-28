import type {
  NotificationLevel,
  NotificationType,
  Prisma,
} from "@prisma/client";
import { prisma, type DbClient } from "@/lib/prisma";
import { bytesToGb } from "@/lib/utils";

export interface NotificationInput {
  userId: string;
  type: NotificationType;
  level?: NotificationLevel;
  title: string;
  body: string;
  link?: string | null;
  dedupeKey?: string | null;
}

export async function createNotification(
  input: NotificationInput,
  db: DbClient = prisma,
) {
  if (input.dedupeKey) {
    await db.userNotification.upsert({
      where: { dedupeKey: input.dedupeKey },
      create: {
        userId: input.userId,
        type: input.type,
        level: input.level ?? "INFO",
        title: input.title,
        body: input.body,
        link: input.link ?? null,
        dedupeKey: input.dedupeKey,
      },
      update: {},
    });
    return;
  }

  await db.userNotification.create({
    data: {
      userId: input.userId,
      type: input.type,
      level: input.level ?? "INFO",
      title: input.title,
      body: input.body,
      link: input.link ?? null,
    },
  });
}

export async function markNotificationRead(
  notificationId: string,
  userId: string,
) {
  await prisma.userNotification.updateMany({
    where: {
      id: notificationId,
      userId,
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });
}

export async function markAllNotificationsRead(userId: string) {
  await prisma.userNotification.updateMany({
    where: {
      userId,
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });
}

export async function deleteNotification(
  notificationId: string,
  userId: string,
) {
  await prisma.userNotification.deleteMany({
    where: {
      id: notificationId,
      userId,
    },
  });
}

export async function deleteReadNotifications(userId: string) {
  await prisma.userNotification.deleteMany({
    where: {
      userId,
      isRead: true,
    },
  });
}

function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export async function dispatchSubscriptionReminders(db: DbClient = prisma) {
  const now = new Date();
  const expiryWindow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const expiringSubscriptions = await db.userSubscription.findMany({
    where: {
      status: "ACTIVE",
      endDate: {
        gt: now,
        lte: expiryWindow,
      },
    },
    include: {
      plan: {
        select: {
          name: true,
        },
      },
    },
  });

  for (const subscription of expiringSubscriptions) {
    const daysLeft = Math.max(
      0,
      Math.ceil((subscription.endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
    );

    await createNotification(
      {
        userId: subscription.userId,
        type: "SUBSCRIPTION",
        level: daysLeft <= 1 ? "WARNING" : "INFO",
        title: "订阅即将到期",
        body: `${subscription.plan.name} 将在 ${daysLeft} 天内到期，请及时续费以避免中断。`,
        link: "/subscriptions",
        dedupeKey: `expiry:${subscription.id}:${subscription.endDate.toISOString().slice(0, 10)}`,
      },
      db,
    );
  }

  const highUsageSubscriptions = await db.userSubscription.findMany({
    where: {
      status: "ACTIVE",
      trafficLimit: {
        not: null,
      },
    },
    include: {
      plan: {
        select: {
          name: true,
        },
      },
    },
  });

  for (const subscription of highUsageSubscriptions) {
    const limit = Number(subscription.trafficLimit ?? BigInt(0));
    if (limit <= 0) {
      continue;
    }

    const used = Number(subscription.trafficUsed);
    const ratio = used / limit;
    if (ratio < 0.8 || ratio >= 1.0) {
      continue;
    }

    const remainingGb = Math.max(
      0,
      Math.floor(bytesToGb((subscription.trafficLimit ?? BigInt(0)) - subscription.trafficUsed)),
    );

    await createNotification(
      {
        userId: subscription.userId,
        type: "TRAFFIC",
        level: ratio >= 0.9 ? "WARNING" : "INFO",
        title: "流量余额提醒",
        body: `${subscription.plan.name} 已使用 ${Math.round(ratio * 100)}%，当前剩余约 ${remainingGb} GB。`,
        link: "/subscriptions",
        dedupeKey: `traffic:${subscription.id}:${dayKey()}`,
      },
      db,
    );
  }
}

export function auditMetadata(data: Record<string, unknown>): Prisma.InputJsonValue {
  return data as Prisma.InputJsonValue;
}
