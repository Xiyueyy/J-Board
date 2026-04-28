"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-auth";
import { revalidatePath } from "next/cache";
import {
  normalizePaymentConfig,
  parsePaymentConfig,
} from "@/services/payment/catalog";
import { actorFromSession, recordAuditLog } from "@/services/audit";
import { z } from "zod";

export async function savePaymentConfig(
  provider: string,
  config: Record<string, string>,
  enabled: boolean
) {
  const session = await requireAdmin();

  const normalizedConfig = normalizePaymentConfig(config);
  let finalConfig = normalizedConfig as Record<string, string | number>;

  if (enabled) {
    try {
      finalConfig = parsePaymentConfig(provider, normalizedConfig) as Record<string, string | number>;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const messages = error.issues.map((e) => e.message).join("；");
        throw new Error(messages);
      }
      throw error;
    }
  }

  const jsonConfig = JSON.parse(JSON.stringify(finalConfig));

  await prisma.paymentConfig.upsert({
    where: { provider },
    create: { provider, config: jsonConfig, enabled },
    update: { config: jsonConfig, enabled },
  });
  await recordAuditLog({
    actor: actorFromSession(session),
    action: "payment.config",
    targetType: "PaymentConfig",
    targetId: provider,
    targetLabel: provider,
    message: `${enabled ? "启用并更新" : "更新"}支付配置 ${provider}`,
  });
  revalidatePath("/admin/payments");
}
