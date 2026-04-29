import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { sanitizeInboundSettings, sanitizeStreamSettings } from "@/services/node-inbound-sanitize";

const nodeDetailSelect = {
  id: true,
  name: true,
  panelUrl: true,
  status: true,
  inbounds: {
    where: { isActive: true },
    orderBy: { updatedAt: "desc" },
    include: {
      clients: {
        select: { id: true },
      },
    },
  },
} satisfies Prisma.NodeServerSelect;

export type NodeDetail = Prisma.NodeServerGetPayload<{
  select: typeof nodeDetailSelect;
}>;

export async function getNodeDetail(id: string): Promise<NodeDetail> {
  const node = await prisma.nodeServer.findUnique({
    where: { id },
    select: nodeDetailSelect,
  });
  if (!node) notFound();

  return {
    ...node,
    inbounds: node.inbounds.map((inbound) => ({
      ...inbound,
      settings: sanitizeInboundSettings(inbound.settings),
      streamSettings: sanitizeStreamSettings(inbound.streamSettings),
    })),
  };
}
