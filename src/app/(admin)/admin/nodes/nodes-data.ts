import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parsePage } from "@/lib/utils";
import { getConfiguredSiteUrl } from "@/services/site-url";

const nodeInclude = {
  _count: { select: { inbounds: true } },
  inbounds: {
    where: { isActive: true },
    select: {
      id: true,
      protocol: true,
      port: true,
      tag: true,
      settings: true,
    },
    orderBy: { updatedAt: "desc" },
  },
} satisfies Prisma.NodeServerInclude;

export type NodeServerRow = Prisma.NodeServerGetPayload<{
  include: typeof nodeInclude;
}>;

export async function getNodeServers(
  searchParams: Record<string, string | string[] | undefined>,
) {
  const { page, skip, pageSize } = parsePage(searchParams);
  const q = typeof searchParams.q === "string" ? searchParams.q.trim() : "";
  const status = typeof searchParams.status === "string" ? searchParams.status : "";

  const where = {
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { panelUrl: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  } satisfies Prisma.NodeServerWhereInput;

  const [nodes, total, siteUrl] = await Promise.all([
    prisma.nodeServer.findMany({
      where,
      include: nodeInclude,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.nodeServer.count({ where }),
    getConfiguredSiteUrl(),
  ]);

  return { nodes, total, page, pageSize, filters: { q, status }, siteUrl };
}
