"use server";

import { requireAdmin } from "@/lib/require-auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";

export async function revealCredential(serviceId: string): Promise<string> {
  await requireAdmin();
  const service = await prisma.streamingService.findUnique({
    where: { id: serviceId },
    select: { credentials: true },
  });
  if (!service) throw new Error("服务不存在");
  return decrypt(service.credentials);
}
