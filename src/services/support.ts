import type { DbClient } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";

const MAX_ATTACHMENT_COUNT = 3;
const MAX_ATTACHMENT_SIZE = 3 * 1024 * 1024;
const ALLOWED_ATTACHMENT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
] as const;

const attachmentMimeTypeSet = new Set<string>(ALLOWED_ATTACHMENT_MIME_TYPES);
const extensionMimeTypeMap = new Map<string, string>([
  ["jpg", "image/jpeg"],
  ["jpeg", "image/jpeg"],
  ["png", "image/png"],
  ["webp", "image/webp"],
  ["gif", "image/gif"],
  ["avif", "image/avif"],
]);

export const SUPPORT_ATTACHMENT_ACCEPT = ALLOWED_ATTACHMENT_MIME_TYPES.join(",");

export { supportTicketPriorityLabels, supportTicketStatusLabels } from "./support-labels";

function toFiles(input: FormDataEntryValue[]): File[] {
  return input.filter((value): value is File => value instanceof File && value.size > 0);
}

function inferMimeTypeFromName(name: string) {
  const extension = name.split(".").pop()?.toLowerCase();
  if (!extension) {
    return null;
  }

  return extensionMimeTypeMap.get(extension) ?? null;
}

function normalizeSupportAttachmentMimeType(file: File) {
  const directType = file.type.trim().toLowerCase();
  if (attachmentMimeTypeSet.has(directType)) {
    return directType;
  }

  return inferMimeTypeFromName(file.name);
}

export function isSupportImageMimeType(mimeType: string) {
  return attachmentMimeTypeSet.has(mimeType.trim().toLowerCase());
}

export function buildSupportAttachmentUrl(
  attachmentId: string,
  options?: { download?: boolean },
) {
  const params = new URLSearchParams();
  if (options?.download) {
    params.set("download", "1");
  }

  const query = params.toString();
  return `/api/support/attachments/${attachmentId}${query ? `?${query}` : ""}`;
}

export function parseSupportAttachments(entries: FormDataEntryValue[]) {
  const files = toFiles(entries);

  if (files.length > MAX_ATTACHMENT_COUNT) {
    throw new Error(`最多上传 ${MAX_ATTACHMENT_COUNT} 张图片`);
  }

  for (const file of files) {
    if (file.size > MAX_ATTACHMENT_SIZE) {
      throw new Error(`图片 ${file.name} 超过 ${(MAX_ATTACHMENT_SIZE / 1024 / 1024).toFixed(0)}MB 限制`);
    }

    if (!normalizeSupportAttachmentMimeType(file)) {
      throw new Error(`图片 ${file.name} 格式不支持，仅支持 JPG、PNG、WEBP、GIF、AVIF`);
    }
  }

  return files;
}

export async function createSupportAttachments(
  input: {
    ticketId: string;
    replyId: string;
    files: File[];
  },
  db: DbClient = prisma,
) {
  for (const file of input.files) {
    const mimeType = normalizeSupportAttachmentMimeType(file);
    if (!mimeType) {
      throw new Error(`图片 ${file.name} 格式不支持`);
    }

    await db.supportTicketAttachment.create({
      data: {
        ticketId: input.ticketId,
        replyId: input.replyId,
        fileName: file.name,
        mimeType,
        size: file.size,
        content: Buffer.from(await file.arrayBuffer()),
      },
    });
  }
}

export async function deleteSupportTicketRecords(
  ticketId: string,
  db: DbClient = prisma,
) {
  const links = [`/support/${ticketId}`, `/admin/support/${ticketId}`];

  await db.userNotification.deleteMany({
    where: {
      link: {
        in: links,
      },
    },
  });
  await db.supportTicketAttachment.deleteMany({
    where: {
      ticketId,
    },
  });
  await db.supportTicketReply.deleteMany({
    where: {
      ticketId,
    },
  });
  await db.supportTicket.delete({
    where: {
      id: ticketId,
    },
  });
}
