import { isIP } from "node:net";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authenticateAgent, isAuthError } from "@/lib/agent-auth";
import { getIpGeoContext } from "@/lib/request-context";
import { getAppConfig } from "@/services/app-config";
import { evaluateNodeAccessAbuseRisk, recordSubscriptionAccess } from "@/services/subscription-risk";

const MAX_EVENTS = 500;
const MAX_TEXT_LENGTH = 200;

const nodeAccessEventSchema = z.object({
  clientEmail: z.string().trim().min(1).max(320),
  sourceIp: z.string().trim().refine((value) => isIP(value) !== 0, "sourceIp 必须是有效 IP"),
  inboundTag: z.string().trim().max(MAX_TEXT_LENGTH).optional().nullable(),
  network: z.string().trim().max(16).optional().nullable(),
  targetHost: z.string().trim().max(MAX_TEXT_LENGTH).optional().nullable(),
  targetPort: z.coerce.number().int().min(0).max(65535).optional().nullable(),
  action: z.string().trim().max(32).optional().nullable(),
  connectionCount: z.coerce.number().int().min(1).max(100000).optional().default(1),
  uniqueTargetCount: z.coerce.number().int().min(0).max(100000).optional().default(0),
  firstSeenAt: z.string().trim().max(64).optional().nullable(),
  lastSeenAt: z.string().trim().max(64).optional().nullable(),
});

const nodeAccessPayloadSchema = z.object({
  events: z.array(nodeAccessEventSchema).min(1).max(MAX_EVENTS),
});

function compactText(value: string | null | undefined) {
  const text = value?.trim();
  return text ? text.slice(0, MAX_TEXT_LENGTH) : null;
}

function normalizeAction(action: string | null | undefined) {
  const normalized = action?.trim().toLowerCase();
  return normalized === "rejected" ? "rejected" : "accepted";
}

function buildReason(event: z.infer<typeof nodeAccessEventSchema>, nodeId: string) {
  const parts = [
    "来源：节点 Xray access log",
    "节点：" + nodeId,
    event.inboundTag ? "入站：" + event.inboundTag : null,
    event.network ? "网络：" + event.network : null,
    event.targetPort ? "目标端口：" + event.targetPort : null,
    event.targetHost ? "样本目标：" + event.targetHost : null,
    "连接数：" + event.connectionCount,
    event.uniqueTargetCount ? "不同目标：" + event.uniqueTargetCount : null,
    event.firstSeenAt ? "首次：" + event.firstSeenAt : null,
    event.lastSeenAt ? "最近：" + event.lastSeenAt : null,
  ].filter(Boolean);
  return parts.join("；").slice(0, 1000);
}

export async function POST(req: Request) {
  const auth = await authenticateAgent(req);
  if (isAuthError(auth)) return auth;
  const { nodeId } = auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体不是有效 JSON，期望格式：{ events: [...] }" }, { status: 400 });
  }

  const parsed = nodeAccessPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "节点访问日志格式无效" }, { status: 400 });
  }

  const config = await getAppConfig();
  if (!config.subscriptionRiskEnabled || !config.nodeAccessRiskEnabled) {
    return NextResponse.json({ ok: true, skipped: parsed.data.events.length, reason: "node_access_risk_disabled" });
  }

  const clientEmails = [...new Set(parsed.data.events.map((event) => event.clientEmail))];
  const clients = await prisma.nodeClient.findMany({
    where: {
      email: { in: clientEmails },
      inbound: { serverId: nodeId },
    },
    select: {
      email: true,
      userId: true,
      subscriptionId: true,
    },
  });
  const clientByEmail = new Map(clients.map((client) => [client.email, client]));

  let processed = 0;
  let skipped = 0;
  let warnings = 0;
  let suspended = 0;

  for (const event of parsed.data.events) {
    const client = clientByEmail.get(event.clientEmail);
    if (!client) {
      skipped++;
      continue;
    }

    const action = normalizeAction(event.action);
    const allowed = action === "accepted";
    const result = await recordSubscriptionAccess({
      kind: "SINGLE",
      userId: client.userId,
      subscriptionId: client.subscriptionId,
      context: {
        ip: event.sourceIp,
        userAgent: "jboard-agent/xray-access-log",
        geo: getIpGeoContext(event.sourceIp),
      },
      allowed,
      reason: buildReason({
        ...event,
        inboundTag: compactText(event.inboundTag),
        network: compactText(event.network),
        targetHost: compactText(event.targetHost),
        action,
      }, nodeId),
      evaluateRisk: allowed,
      riskConfig: config,
      sourceLabel: "节点真实连接",
    });

    const abuseResult = allowed
      ? await evaluateNodeAccessAbuseRisk({
          userId: client.userId,
          subscriptionId: client.subscriptionId,
          ip: event.sourceIp,
          connectionCount: event.connectionCount,
          uniqueTargetCount: event.uniqueTargetCount,
          targetHost: compactText(event.targetHost),
          targetPort: event.targetPort ?? null,
          config,
        })
      : { warned: false, suspended: false };

    processed++;
    if (result.warned || abuseResult.warned) warnings++;
    if (result.suspended || abuseResult.suspended) suspended++;
  }

  return NextResponse.json({ ok: true, processed, skipped, warnings, suspended });
}
