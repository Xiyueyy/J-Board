import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

const nodeDetailInclude = {
  inbounds: {
    where: { isActive: true },
    orderBy: { updatedAt: "desc" },
    include: {
      clients: {
        select: { id: true },
      },
    },
  },
} satisfies Prisma.NodeServerInclude;

export type NodeDetail = Prisma.NodeServerGetPayload<{
  include: typeof nodeDetailInclude;
}>;

export async function getNodeDetail(id: string): Promise<NodeDetail> {
  const node = await prisma.nodeServer.findUnique({
    where: { id },
    include: nodeDetailInclude,
  });
  if (!node) notFound();
  return node;
}
