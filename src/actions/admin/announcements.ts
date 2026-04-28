"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-auth";
import { actorFromSession, recordAuditLog } from "@/services/audit";
import {
  deleteAnnouncementNotifications,
  dispatchAnnouncementNotifications,
  syncAnnouncementNotifications,
} from "@/services/announcements";

const announcementSchema = z.object({
  title: z.string().trim().min(1, "标题不能为空"),
  body: z.string().trim().min(1, "内容不能为空"),
  audience: z.enum(["PUBLIC", "USERS", "ADMINS", "SPECIFIC_USER"]),
  displayType: z.enum(["INLINE", "BIG", "POPUP"]).default("INLINE"),
  targetUserId: z.string().optional(),
  dismissible: z.string().optional(),
  sendNotification: z.string().optional(),
  startAt: z.string().optional(),
  endAt: z.string().optional(),
});

function revalidateAnnouncementViews() {
  revalidatePath("/admin/announcements");
  revalidatePath("/dashboard");
  revalidatePath("/account");
  revalidatePath("/notifications");
  revalidatePath("/login");
}

function parseAnnouncementInput(formData: FormData) {
  const data = announcementSchema.parse(Object.fromEntries(formData));

  if (data.audience === "SPECIFIC_USER" && !data.targetUserId) {
    throw new Error("定向消息必须选择用户");
  }

  const startAt = data.startAt ? new Date(data.startAt) : null;
  const endAt = data.endAt ? new Date(data.endAt) : null;
  if (startAt && Number.isNaN(startAt.getTime())) {
    throw new Error("开始时间格式无效");
  }
  if (endAt && Number.isNaN(endAt.getTime())) {
    throw new Error("结束时间格式无效");
  }
  if (startAt && endAt && endAt <= startAt) {
    throw new Error("结束时间必须晚于开始时间");
  }

  return {
    title: data.title,
    body: data.body,
    audience: data.audience,
    displayType: data.displayType,
    targetUserId: data.audience === "SPECIFIC_USER" ? data.targetUserId ?? null : null,
    dismissible: data.dismissible === "true",
    sendNotification: data.sendNotification === "true",
    startAt,
    endAt,
  };
}

export async function createAnnouncement(formData: FormData) {
  const session = await requireAdmin();
  const data = parseAnnouncementInput(formData);

  const announcement = await prisma.announcement.create({
    data: {
      title: data.title,
      body: data.body,
      audience: data.audience,
      displayType: data.displayType,
      targetUserId: data.targetUserId,
      createdById: session.user.id,
      isActive: true,
      dismissible: data.dismissible,
      sendNotification: data.sendNotification,
      startAt: data.startAt,
      endAt: data.endAt,
    },
  });

  await dispatchAnnouncementNotifications(announcement.id);
  await recordAuditLog({
    actor: actorFromSession(session),
    action: "announcement.create",
    targetType: "Announcement",
    targetId: announcement.id,
    targetLabel: announcement.title,
    message: `创建公告/消息 ${announcement.title}`,
  });

  revalidateAnnouncementViews();
}

export async function updateAnnouncement(id: string, formData: FormData) {
  const session = await requireAdmin();
  const data = parseAnnouncementInput(formData);

  const announcement = await prisma.announcement.update({
    where: { id },
    data: {
      title: data.title,
      body: data.body,
      audience: data.audience,
      displayType: data.displayType,
      targetUserId: data.targetUserId,
      dismissible: data.dismissible,
      sendNotification: data.sendNotification,
      startAt: data.startAt,
      endAt: data.endAt,
    },
  });

  await syncAnnouncementNotifications(announcement.id);
  await recordAuditLog({
    actor: actorFromSession(session),
    action: "announcement.update",
    targetType: "Announcement",
    targetId: announcement.id,
    targetLabel: announcement.title,
    message: `更新公告/消息 ${announcement.title}`,
  });

  revalidateAnnouncementViews();
}

export async function toggleAnnouncement(id: string, isActive: boolean) {
  const session = await requireAdmin();
  const announcement = await prisma.announcement.update({
    where: { id },
    data: { isActive },
  });

  await recordAuditLog({
    actor: actorFromSession(session),
    action: isActive ? "announcement.enable" : "announcement.disable",
    targetType: "Announcement",
    targetId: announcement.id,
    targetLabel: announcement.title,
    message: `${isActive ? "启用" : "停用"}公告/消息 ${announcement.title}`,
  });

  if (isActive) {
    await dispatchAnnouncementNotifications(announcement.id);
  }

  revalidateAnnouncementViews();
}

export async function deleteAnnouncement(id: string) {
  const session = await requireAdmin();
  const announcement = await prisma.announcement.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
    },
  });

  if (!announcement) {
    throw new Error("公告不存在");
  }

  await prisma.$transaction(async (tx) => {
    await deleteAnnouncementNotifications(announcement.id, tx);
    await tx.announcement.delete({
      where: {
        id: announcement.id,
      },
    });
    await recordAuditLog(
      {
        actor: actorFromSession(session),
        action: "announcement.delete",
        targetType: "Announcement",
        targetId: announcement.id,
        targetLabel: announcement.title,
        message: `删除公告/消息 ${announcement.title}`,
      },
      tx,
    );
  });

  revalidateAnnouncementViews();
}
