"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/require-auth";
import { actorFromSession, recordAuditLog } from "@/services/audit";
import { createNotification } from "@/services/notifications";
import {
  createSupportAttachments,
  deleteSupportTicketRecords,
  parseSupportAttachments,
} from "@/services/support";

const createTicketSchema = z.object({
  subject: z.string().trim().min(1, "标题不能为空"),
  category: z.string().trim().optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  body: z.string().trim().min(1, "内容不能为空"),
});

export async function createSupportTicket(formData: FormData) {
  const session = await requireAuth();
  const data = createTicketSchema.parse(Object.fromEntries(formData));
  const attachments = parseSupportAttachments(formData.getAll("attachments"));

  const ticket = await prisma.supportTicket.create({
    data: {
      userId: session.user.id,
      subject: data.subject,
      category: data.category || null,
      priority: data.priority,
      status: "OPEN",
      lastReplyAt: new Date(),
      replies: {
        create: {
          authorUserId: session.user.id,
          isAdmin: false,
          body: data.body,
        },
      },
    },
    include: {
      replies: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  const firstReply = ticket.replies[0];
  if (firstReply && attachments.length > 0) {
    await createSupportAttachments({
      ticketId: ticket.id,
      replyId: firstReply.id,
      files: attachments,
    });
  }

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", status: "ACTIVE" },
    select: { id: true },
  });
  for (const admin of admins) {
    await createNotification({
      userId: admin.id,
      type: "SYSTEM",
      level: "INFO",
      title: "新工单待处理",
      body: `收到新工单：${data.subject}`,
      link: `/admin/support/${ticket.id}`,
      dedupeKey: `support-created:${ticket.id}:${admin.id}`,
    });
  }

  revalidatePath("/support");
  revalidatePath(`/support/${ticket.id}`);
  revalidatePath("/admin/support");
}

export async function replySupportTicket(ticketId: string, formData: FormData) {
  const session = await requireAuth();
  const body = String(formData.get("body") || "").trim();
  const attachments = parseSupportAttachments(formData.getAll("attachments"));
  if (!body) {
    throw new Error("回复内容不能为空");
  }

  const ticket = await prisma.supportTicket.findFirst({
    where: {
      id: ticketId,
      userId: session.user.id,
    },
    select: {
      id: true,
      subject: true,
      status: true,
    },
  });
  if (!ticket) {
    throw new Error("工单不存在");
  }
  if (ticket.status === "CLOSED") {
    throw new Error("已关闭的工单不能继续回复");
  }

  const updated = await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: {
      status: "USER_REPLIED",
      closedAt: null,
      lastReplyAt: new Date(),
      replies: {
        create: {
          authorUserId: session.user.id,
          isAdmin: false,
          body,
        },
      },
    },
    include: {
      replies: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  const createdReply = updated.replies[0];
  if (createdReply && attachments.length > 0) {
    await createSupportAttachments({
      ticketId: ticket.id,
      replyId: createdReply.id,
      files: attachments,
    });
  }

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", status: "ACTIVE" },
    select: { id: true },
  });
  for (const admin of admins) {
    await createNotification({
      userId: admin.id,
      type: "SYSTEM",
      level: "INFO",
      title: "工单有新回复",
      body: `工单「${ticket.subject}」有用户新回复。`,
      link: `/admin/support/${ticket.id}`,
    });
  }

  revalidatePath(`/support/${ticket.id}`);
  revalidatePath("/support");
  revalidatePath(`/admin/support/${ticket.id}`);
}

export async function closeSupportTicket(ticketId: string) {
  const session = await requireAuth();
  const ticket = await prisma.supportTicket.findFirst({
    where: {
      id: ticketId,
      userId: session.user.id,
    },
    select: {
      id: true,
      subject: true,
      status: true,
    },
  });

  if (!ticket) {
    throw new Error("工单不存在");
  }

  if (ticket.status === "CLOSED") {
    return;
  }

  await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: {
      status: "CLOSED",
      closedAt: new Date(),
    },
  });

  await recordAuditLog({
    actor: actorFromSession(session),
    action: "support.close",
    targetType: "SupportTicket",
    targetId: ticket.id,
    targetLabel: ticket.subject,
    message: `用户关闭工单 ${ticket.subject}`,
  });

  revalidatePath("/support");
  revalidatePath(`/support/${ticket.id}`);
  revalidatePath("/admin/support");
  revalidatePath(`/admin/support/${ticket.id}`);
}

export async function deleteSupportTicket(ticketId: string) {
  const session = await requireAuth();
  const ticket = await prisma.supportTicket.findFirst({
    where: {
      id: ticketId,
      userId: session.user.id,
    },
    select: {
      id: true,
      subject: true,
    },
  });

  if (!ticket) {
    throw new Error("工单不存在");
  }

  await prisma.$transaction(async (tx) => {
    await deleteSupportTicketRecords(ticket.id, tx);
    await recordAuditLog(
      {
        actor: actorFromSession(session),
        action: "support.delete",
        targetType: "SupportTicket",
        targetId: ticket.id,
        targetLabel: ticket.subject,
        message: `用户删除工单 ${ticket.subject}`,
      },
      tx,
    );
  });

  revalidatePath("/support");
  revalidatePath(`/support/${ticket.id}`);
  revalidatePath("/admin/support");
  revalidatePath(`/admin/support/${ticket.id}`);
  revalidatePath("/notifications");
}
