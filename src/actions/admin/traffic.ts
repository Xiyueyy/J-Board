"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-auth";
import { actorFromSession, recordAuditLog } from "@/services/audit";
import { syncNodeClientTraffic } from "@/services/traffic-sync";

export async function syncTrafficViews() {
  const session = await requireAdmin();
  const result = await syncNodeClientTraffic({ maxAgeMs: 0 });
  await recordAuditLog({
    actor: actorFromSession(session),
    action: "traffic.sync",
    targetType: "TrafficSync",
    message: `同步 3x-ui 流量：成功 ${result.synced} 个，失败 ${result.failed} 个`,
    metadata: {
      scanned: result.scanned,
      synced: result.synced,
      skipped: result.skipped,
      failed: result.failed,
      uploadDelta: result.uploadDelta,
      downloadDelta: result.downloadDelta,
      errors: result.errors,
    },
  });
  revalidatePath("/admin/traffic");
  revalidatePath("/dashboard");
  revalidatePath("/subscriptions");
  revalidatePath("/notifications");
  return result;
}

export async function revalidateTrafficViews() {
  return syncTrafficViews();
}
