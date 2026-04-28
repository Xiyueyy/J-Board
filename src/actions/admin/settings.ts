"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-auth";
import { actorFromSession, recordAuditLog } from "@/services/audit";
import { getAppConfig } from "@/services/app-config";
import { normalizeSiteUrl } from "@/services/site-url";

const settingsSchema = z.object({
  siteName: z.string().trim().min(1, "站点名称不能为空"),
  siteUrl: z.string().trim().optional(),
  supportContact: z.string().trim().optional(),
  maintenanceNotice: z.string().trim().optional(),
  siteNotice: z.string().trim().optional(),
  allowRegistration: z.string().optional(),
  requireInviteCode: z.string().optional(),
  autoReminderDispatchEnabled: z.string().optional(),
  reminderDispatchIntervalMinutes: z.coerce.number().int().positive().optional(),
  trafficSyncEnabled: z.string().optional(),
  trafficSyncIntervalSeconds: z.coerce.number().int().min(10).optional(),
  inviteRewardEnabled: z.string().optional(),
  inviteRewardRate: z.coerce.number().min(0).max(100).optional(),
  inviteRewardCouponId: z.string().trim().optional(),
  turnstileSiteKey: z.string().trim().optional(),
  turnstileSecretKey: z.string().trim().optional(),
});

export async function saveAppSettings(formData: FormData) {
  const session = await requireAdmin();
  const parsed = settingsSchema.parse(Object.fromEntries(formData));
  const current = await getAppConfig();

  const next = {
    siteName: parsed.siteName,
    siteUrl: normalizeSiteUrl(parsed.siteUrl) || null,
    supportContact: parsed.supportContact || null,
    maintenanceNotice: parsed.maintenanceNotice || null,
    siteNotice: parsed.siteNotice || null,
    allowRegistration: parsed.allowRegistration === "true",
    requireInviteCode: parsed.requireInviteCode === "true",
    autoReminderDispatchEnabled: parsed.autoReminderDispatchEnabled === "true",
    reminderDispatchIntervalMinutes:
      parsed.reminderDispatchIntervalMinutes ?? current.reminderDispatchIntervalMinutes,
    trafficSyncEnabled: parsed.trafficSyncEnabled === "true",
    trafficSyncIntervalSeconds:
      parsed.trafficSyncIntervalSeconds ?? current.trafficSyncIntervalSeconds,
    inviteRewardEnabled: parsed.inviteRewardEnabled === "true",
    inviteRewardRate: parsed.inviteRewardRate ?? Number(current.inviteRewardRate),
    inviteRewardCouponId: parsed.inviteRewardCouponId || null,
    turnstileSiteKey: parsed.turnstileSiteKey || null,
    turnstileSecretKey: parsed.turnstileSecretKey || null,
  };

  await prisma.appConfig.upsert({
    where: { id: current.id },
    create: { id: current.id, ...next },
    update: next,
  });

  await recordAuditLog({
    actor: actorFromSession(session),
    action: "settings.update",
    targetType: "AppConfig",
    targetId: current.id,
    targetLabel: next.siteName,
    message: "更新系统设置",
  });

  revalidatePath("/admin/settings");
  revalidatePath("/login");
  revalidatePath("/register");
  revalidatePath("/dashboard");
  revalidatePath("/subscriptions");
  revalidatePath("/admin/nodes");
  revalidatePath("/account");
  revalidatePath("/admin/commerce");
}
