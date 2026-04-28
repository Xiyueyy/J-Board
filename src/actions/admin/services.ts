"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-auth";
import { encrypt } from "@/lib/crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actorFromSession, recordAuditLog } from "@/services/audit";
import { createNotification } from "@/services/notifications";

const serviceSchema = z.object({
  name: z.string().min(1),
  credentials: z.string().min(1),
  maxSlots: z.coerce.number().int().positive(),
  description: z.string().optional(),
});

export async function createService(formData: FormData) {
  const session = await requireAdmin();
  const data = serviceSchema.parse(Object.fromEntries(formData));
  const service = await prisma.streamingService.create({
    data: {
      name: data.name,
      credentials: encrypt(data.credentials),
      maxSlots: data.maxSlots,
      description: data.description || null,
    },
  });
  await recordAuditLog({
    actor: actorFromSession(session),
    action: "service.create",
    targetType: "StreamingService",
    targetId: service.id,
    targetLabel: service.name,
    message: `创建流媒体服务 ${service.name}`,
  });
  revalidatePath("/admin/services");
}

export async function updateService(id: string, formData: FormData) {
  const session = await requireAdmin();
  const data = serviceSchema.parse(Object.fromEntries(formData));
  const affectedUsers = await prisma.streamingSlot.findMany({
    where: { serviceId: id },
    select: { userId: true },
    distinct: ["userId"],
  });
  const service = await prisma.streamingService.update({
    where: { id },
    data: {
      name: data.name,
      credentials: encrypt(data.credentials),
      maxSlots: data.maxSlots,
      description: data.description || null,
    },
  });
  for (const row of affectedUsers) {
    await createNotification({
      userId: row.userId,
      type: "SYSTEM",
      level: "INFO",
      title: "流媒体凭据已更新",
      body: `${service.name} 的共享凭据已更新，请重新查看最新账号信息。`,
      link: "/subscriptions",
      dedupeKey: `service-credential-update:${service.id}:${row.userId}:${Date.now()}`,
    });
  }
  await recordAuditLog({
    actor: actorFromSession(session),
    action: "service.update",
    targetType: "StreamingService",
    targetId: service.id,
    targetLabel: service.name,
    message: `更新流媒体服务 ${service.name}`,
  });
  revalidatePath("/admin/services");
}

export async function deleteService(id: string) {
  const session = await requireAdmin();
  const service = await prisma.streamingService.findUniqueOrThrow({
    where: { id },
    include: { _count: { select: { slots: true } } },
  });

  if (service._count.slots > 0) {
    throw new Error(`该服务仍有 ${service._count.slots} 个关联槽位，请先清理后再删除`);
  }

  await prisma.streamingService.delete({ where: { id } });

  await recordAuditLog({
    actor: actorFromSession(session),
    action: "service.delete",
    targetType: "StreamingService",
    targetId: service.id,
    targetLabel: service.name,
    message: `彻底删除流媒体服务 ${service.name}`,
  });
  revalidatePath("/admin/services");
  revalidatePath("/store");
}

export async function toggleServiceStatus(id: string, isActive: boolean) {
  const session = await requireAdmin();
  const service = await prisma.streamingService.update({
    where: { id },
    data: { isActive },
  });
  await recordAuditLog({
    actor: actorFromSession(session),
    action: isActive ? "service.enable" : "service.disable",
    targetType: "StreamingService",
    targetId: service.id,
    targetLabel: service.name,
    message: `${isActive ? "启用" : "停用"}流媒体服务 ${service.name}`,
  });
  revalidatePath("/admin/services");
  revalidatePath("/store");
}

export async function batchToggleServiceStatus(formData: FormData) {
  const session = await requireAdmin();
  const isActive = String(formData.get("isActive")) === "true";
  const serviceIds = formData.getAll("serviceIds").map(String).filter(Boolean);

  if (serviceIds.length === 0) {
    throw new Error("请至少选择一个服务");
  }

  const services = await prisma.streamingService.findMany({
    where: { id: { in: serviceIds } },
    select: { id: true, name: true },
  });

  await prisma.streamingService.updateMany({
    where: { id: { in: serviceIds } },
    data: { isActive },
  });

  await recordAuditLog({
    actor: actorFromSession(session),
    action: isActive ? "service.batch_enable" : "service.batch_disable",
    targetType: "StreamingService",
    message: `${isActive ? "批量启用" : "批量停用"} ${services.length} 个流媒体服务`,
    metadata: {
      serviceIds,
    },
  });

  revalidatePath("/admin/services");
  revalidatePath("/store");
}
