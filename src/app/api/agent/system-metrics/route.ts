import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateAgent, isAuthError } from "@/lib/agent-auth";

const MAX_BPS = BigInt("1000000000000000");

function parseNonNegativeBigInt(value: unknown) {
  if (typeof value === "bigint") return value >= BigInt(0) ? value : null;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) return null;
    return BigInt(Math.trunc(value));
  }
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = BigInt(value.trim());
      return parsed >= BigInt(0) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

function compactText(value: unknown, max = 64) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

function parseSampledAt(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return new Date();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

/**
 * POST /api/agent/system-metrics
 * Agent pushes whole-machine network speed sampled from /proc/net/dev.
 * Body: { inboundBps, outboundBps, interfaceName?, sampledAt? }
 */
export async function POST(req: Request) {
  const auth = await authenticateAgent(req);
  if (isAuthError(auth)) return auth;
  const { nodeId } = auth;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体不是有效 JSON，期望格式：{ inboundBps, outboundBps }" }, { status: 400 });
  }

  const inboundBps = parseNonNegativeBigInt(body.inboundBps);
  const outboundBps = parseNonNegativeBigInt(body.outboundBps);
  if (inboundBps == null || outboundBps == null || inboundBps > MAX_BPS || outboundBps > MAX_BPS) {
    return NextResponse.json({ error: "inboundBps/outboundBps 必须是有效的非负数值" }, { status: 400 });
  }

  const metric = await prisma.nodeSystemMetric.upsert({
    where: { nodeId },
    create: {
      nodeId,
      inboundBps,
      outboundBps,
      interfaceName: compactText(body.interfaceName),
      sampledAt: parseSampledAt(body.sampledAt),
    },
    update: {
      inboundBps,
      outboundBps,
      interfaceName: compactText(body.interfaceName),
      sampledAt: parseSampledAt(body.sampledAt),
    },
  });

  return NextResponse.json({ ok: true, sampledAt: metric.sampledAt });
}
