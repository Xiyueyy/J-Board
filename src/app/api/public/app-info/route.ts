import { getAppConfig } from "@/services/app-config";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const now = new Date();
  const [config, announcements] = await Promise.all([
    getAppConfig(),
    prisma.announcement.findMany({
      where: {
        isActive: true,
        audience: "PUBLIC",
        AND: [
          {
            OR: [
              { startAt: null },
              { startAt: { lte: now } },
            ],
          },
          {
            OR: [
              { endAt: null },
              { endAt: { gt: now } },
            ],
          },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  return Response.json({
    siteName: config.siteName,
    allowRegistration: config.allowRegistration,
    requireInviteCode: config.requireInviteCode,
    supportContact: config.supportContact,
    maintenanceNotice: config.maintenanceNotice,
    siteNotice: config.siteNotice,
    announcements: announcements.map((item) => ({
      id: item.id,
      title: item.title,
      body: item.body,
    })),
  });
}
