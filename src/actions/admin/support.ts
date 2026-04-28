"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-auth";
import { actorFromSession, recordAuditLog } from "@/services/audit";
import { createNotification } from "@/services/notifications";
import {
  createSupportAttachments,
  deleteSupportTicketRecords,
  parseSupportAttachments,
} from "@/services/support";

const replySchema = z.object({
  body: z.string().trim().min(1, "回复内容不能为空"),
});

const supportStatusSchema = z.enum(["OPEN", "USER_REPLIED", "ADMIN_REPLIED", "CLOSED"]);
const supportPrioritySchema = z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]);

export async function replySupportAsAdmin(ticketId: string, formData: FormData) {
  const session = await requireAdmin();
  const data = replySchema.parse(Object.fromEntries(formData));
  const attachments = parseSupportAttachments(formData.getAll("attachments"));

  const ticket = await prisma.supportTicket.findUniqueOrThrow({
    where: { id: ticketId },
    include: {
      user: {
        select: { id: true, email: true },
      },
    },
  });
  if (ticket.status === "CLOSED") {
    throw new Error("已关闭的工单不能继续回复，请先重新打开");
  }

  const updated = await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: {
      status: "ADMIN_REPLIED",
      closedAt: null,
      lastReplyAt: new Date(),
      replies: {
        create: {
          authorUserId: session.user.id,
          isAdmin: true,
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
  const createdReply = updated.replies[0];
  if (createdReply && attachments.length > 0) {
    await createSupportAttachments({
      ticketId: ticket.id,
      replyId: createdReply.id,
      files: attachments,
    });
  }

  await createNotification({
    userId: ticket.user.id,
    type: "SYSTEM",
    level: "INFO",
    title: "工单有新回复",
    body: `管理员已回复工单「${ticket.subject}」。`,
    link: `/support/${ticket.id}`,
  });
  await recordAuditLog({
    actor: actorFromSession(session),
    action: "support.reply",
    targetType: "SupportTicket",
    targetId: ticket.id,
    targetLabel: ticket.subject,
    message: `回复工单 ${ticket.subject}`,
  });

  revalidatePath("/admin/support");
  revalidatePath(`/admin/support/${ticket.id}`);
  revalidatePath(`/support/${ticket.id}`);
}

export async function updateSupportTicketMeta(formData: FormData) {
  const session = await requireAdmin();
  const ticketId = String(formData.get("ticketId") || "");
  const status = supportStatusSchema.parse(String(formData.get("status") || ""));
  const priority = supportPrioritySchema.parse(String(formData.get("priority") || ""));

  if (!ticketId) {
    throw new Error("工单 ID 缺失");
  }

  const ticket = await prisma.supportTicket.update({
    where: { id: ticketId },
    data: {
      status,
      priority,
      closedAt: status === "CLOSED" ? new Date() : null,
    },
  });

  await recordAuditLog({
    actor: actorFromSession(session),
    action: "support.update",
    targetType: "SupportTicket",
    targetId: ticket.id,
    targetLabel: ticket.subject,
    message: `更新工单 ${ticket.subject} 状态/优先级`,
  });

  revalidatePath("/admin/support");
  revalidatePath(`/admin/support/${ticket.id}`);
  revalidatePath(`/support/${ticket.id}`);
}

export async function deleteSupportTicketAsAdmin(ticketId: string) {
  const session = await requireAdmin();
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
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
        message: `管理员删除工单 ${ticket.subject}`,
      },
      tx,
    );
  });

  revalidatePath("/admin/support");
  revalidatePath(`/admin/support/${ticket.id}`);
  revalidatePath("/support");
  revalidatePath(`/support/${ticket.id}`);
  revalidatePath("/notifications");
}
