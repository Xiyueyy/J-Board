import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const MAX_NODE_IDS = 100;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const nodeIds = [...new Set(searchParams.get("nodeIds")?.split(",").filter(Boolean) ?? [])]
    .slice(0, MAX_NODE_IDS);

  if (nodeIds.length === 0) {
    return NextResponse.json({});
  }

  const traces = await prisma.routeTrace.findMany({
    where: { nodeId: { in: nodeIds } },
    orderBy: { updatedAt: "desc" },
  });

  const result: Record<string, { carrier: string; summary: string; hopCount: number; hops: unknown; updatedAt: string }[]> = {};
  for (const row of traces) {
    if (!result[row.nodeId]) {
      result[row.nodeId] = [];
    }
    result[row.nodeId].push({
      carrier: row.carrier,
      summary: row.summary,
      hopCount: row.hopCount,
      hops: row.hops,
      updatedAt: row.updatedAt.toISOString(),
    });
  }

  return NextResponse.json(result);
}
