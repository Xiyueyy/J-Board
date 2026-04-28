import { prisma, type DbClient } from "@/lib/prisma";

export async function getAppConfig(db: DbClient = prisma) {
  const existing = await db.appConfig.findUnique({
    where: { id: "default" },
  });

  if (existing) {
    return existing;
  }

  return db.appConfig.create({
    data: { id: "default" },
  });
}

