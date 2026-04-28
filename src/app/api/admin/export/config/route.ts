import { prisma } from "@/lib/prisma";
import { requireAdminApiSession } from "@/lib/admin-api";

export async function GET() {
  const { errorResponse } = await requireAdminApiSession();
  if (errorResponse) {
    return errorResponse;
  }

  const snapshot = await Promise.all([
    prisma.appConfig.findMany(),
    prisma.announcement.findMany(),
    prisma.streamingService.findMany(),
    prisma.subscriptionPlan.findMany({
      include: {
        inboundOptions: true,
      },
    }),
    prisma.nodeServer.findMany(),
    prisma.nodeInbound.findMany(),
    prisma.paymentConfig.findMany(),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    appConfig: snapshot[0],
    announcements: snapshot[1],
    streamingServices: snapshot[2],
    plans: snapshot[3],
    nodes: snapshot[4],
    inbounds: snapshot[5],
    paymentConfigs: snapshot[6],
  };

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="jboard-config-backup.json"',
    },
  });
}
