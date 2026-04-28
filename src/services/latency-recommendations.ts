import { prisma } from "@/lib/prisma";
import { normalizeTraceText } from "@/lib/trace-normalize";
import {
  RECOMMENDATION_CARRIERS,
  carrierLabels,
  type LatencyRecommendation,
} from "@/services/latency-recommendation-types";

export async function getLatencyRecommendations(): Promise<LatencyRecommendation[]> {
  const rows = await prisma.nodeLatency.findMany({
    where: {
      carrier: { in: [...RECOMMENDATION_CARRIERS] },
      node: {
        status: "active",
        plans: {
          some: {
            type: "PROXY",
            isActive: true,
          },
        },
      },
    },
    include: {
      node: {
        select: {
          id: true,
          name: true,
          plans: {
            where: {
              type: "PROXY",
              isActive: true,
            },
            select: {
              id: true,
              name: true,
            },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
            take: 1,
          },
        },
      },
    },
    orderBy: [{ carrier: "asc" }, { latencyMs: "asc" }, { checkedAt: "desc" }],
  });

  const best = new Map<string, LatencyRecommendation>();
  for (const row of rows) {
    if (best.has(row.carrier)) continue;
    const plan = row.node.plans[0];
    if (!plan) continue;

    best.set(row.carrier, {
      carrier: row.carrier,
      carrierLabel: carrierLabels[row.carrier] ?? row.carrier,
      nodeId: row.node.id,
      nodeName: normalizeTraceText(row.node.name),
      planId: plan.id,
      planName: normalizeTraceText(plan.name),
      latencyMs: row.latencyMs,
      checkedAt: row.checkedAt.toISOString(),
    });
  }

  return RECOMMENDATION_CARRIERS
    .map((carrier) => best.get(carrier))
    .filter((item): item is LatencyRecommendation => item != null);
}
