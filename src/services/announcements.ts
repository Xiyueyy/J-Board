import { prisma, type DbClient } from "@/lib/prisma";
import { createNotification } from "@/services/notifications";

function announcementNotificationPrefix(announcementId: string) {
  return `announcement:${announcementId}:`;
}

export async function getVisibleAnnouncements(options?: {
  userId?: string | null;
  role?: "ADMIN" | "USER" | null;
  db?: DbClient;
}) {
  const db = options?.db ?? prisma;
  const now = new Date();
  const audienceConditions = options?.userId
    ? [
        { audience: "PUBLIC" as const },
        ...(options?.role === "ADMIN" ? [{ audience: "ADMINS" as const }] : []),
        { audience: "USERS" as const },
        { audience: "SPECIFIC_USER" as const, targetUserId: options.userId },
      ]
    : [
        { audience: "PUBLIC" as const },
        ...(options?.role === "ADMIN" ? [{ audience: "ADMINS" as const }] : []),
      ];

  const announcements = await db.announcement.findMany({
    where: {
      isActive: true,
      AND: [
        {
          OR: [
            { startAt: null },
            { startAt: { lte: now } },
          ],
        },
        {
          OR: [
            { endAt: null },
            { endAt: { gt: now } },
          ],
        },
        {
          OR: audienceConditions,
        },
      ],
    },
    orderBy: [{ createdAt: "desc" }],
  });

  return announcements;
}

export async function dispatchAnnouncementNotifications(
  announcementId: string,
  db: DbClient = prisma,
) {
  const announcement = await db.announcement.findUnique({
    where: { id: announcementId },
  });

  if (!announcement || !announcement.sendNotification || !announcement.isActive) {
    return;
  }

  let users: Array<{ id: string }> = [];

  switch (announcement.audience) {
    case "SPECIFIC_USER":
      if (announcement.targetUserId) {
        users = [{ id: announcement.targetUserId }];
      }
      break;
    case "ADMINS":
      users = await db.user.findMany({
        where: { role: "ADMIN" },
        select: { id: true },
      });
      break;
    case "USERS":
      users = await db.user.findMany({
        where: { role: "USER" },
        select: { id: true },
      });
      break;
    case "PUBLIC":
      return;
  }

  for (const user of users) {
    await createNotification(
      {
        userId: user.id,
        type: "SYSTEM",
        level: "INFO",
        title: announcement.title,
        body: announcement.body,
        link: "/notifications",
        dedupeKey: `${announcementNotificationPrefix(announcement.id)}${user.id}`,
      },
      db,
    );
  }
}

export async function deleteAnnouncementNotifications(
  announcementId: string,
  db: DbClient = prisma,
) {
  await db.userNotification.deleteMany({
    where: {
      dedupeKey: {
        startsWith: announcementNotificationPrefix(announcementId),
      },
    },
  });
}

export async function syncAnnouncementNotifications(
  announcementId: string,
  db: DbClient = prisma,
) {
  await deleteAnnouncementNotifications(announcementId, db);
  await dispatchAnnouncementNotifications(announcementId, db);
}
