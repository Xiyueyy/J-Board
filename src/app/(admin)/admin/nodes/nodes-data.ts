import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parsePage } from "@/lib/utils";
import { getConfiguredSiteUrl } from "@/services/site-url";
import { sanitizeInboundSettings } from "@/services/node-inbound-sanitize";

const ONLINE_WINDOW_MS = 2 * 60 * 1000;

const nodeSelect = {
  id: true,
  name: true,
  panelUrl: true,
  panelUsername: true,
  status: true,
  agentToken: true,
  _count: { select: { inbounds: true } },
  systemMetric: {
    select: {
      inboundBps: true,
      outboundBps: true,
      interfaceName: true,
      sampledAt: true,
      updatedAt: true,
    },
  },
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
} satisfies Prisma.NodeServerSelect;

export type NodeServerRow = Prisma.NodeServerGetPayload<{
  select: typeof nodeSelect;
}> & {
  onlineUserCount: number;
  systemMetricFresh: boolean;
  systemMetricHint: string;
};

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
      select: nodeSelect,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.nodeServer.count({ where }),
    getConfiguredSiteUrl(),
  ]);

  const nodeIds = nodes.map((node) => node.id);
  const now = new Date();
  const onlineUserCountByNodeId = await getOnlineUserCountByNodeId(nodeIds, now);

  const safeNodes = nodes.map((node) => ({
    ...node,
    agentToken: node.agentToken ? "configured" : null,
    onlineUserCount: onlineUserCountByNodeId.get(node.id)?.size ?? 0,
    systemMetricFresh: isMetricFresh(node.systemMetric?.sampledAt ?? null, now),
    systemMetricHint: getSystemMetricHint(node.systemMetric, now),
    inbounds: node.inbounds.map((inbound) => ({
      ...inbound,
      settings: sanitizeInboundSettings(inbound.settings),
    })),
  }));

  return { nodes: safeNodes, total, page, pageSize, filters: { q, status }, siteUrl };
}

function isMetricFresh(sampledAt: Date | null, now: Date) {
  return sampledAt ? now.getTime() - sampledAt.getTime() <= 60 * 1000 : false;
}

function formatRelativeAge(date: Date, now: Date) {
  const seconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
  if (seconds < 60) return `${seconds} 秒前`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}

function getSystemMetricHint(
  metric: Prisma.NodeServerGetPayload<{ select: typeof nodeSelect }>["systemMetric"],
  now: Date,
) {
  if (!metric) return "需要升级并运行新版 Agent 后显示整机速度";
  const parts = [
    metric.interfaceName ? `网卡 ${metric.interfaceName}` : null,
    formatRelativeAge(metric.sampledAt, now),
    isMetricFresh(metric.sampledAt, now) ? null : "已过期",
  ].filter(Boolean);
  return parts.join(" · ");
}

async function getOnlineUserCountByNodeId(nodeIds: string[], now = new Date()) {
  const onlineUsersByNodeId = new Map<string, Set<string>>();
  if (nodeIds.length === 0) return onlineUsersByNodeId;

  const onlineWindowStart = new Date(now.getTime() - ONLINE_WINDOW_MS);
  const [recentTrafficLogs, recentAccessLogs] = await Promise.all([
    prisma.trafficLog.findMany({
      where: { timestamp: { gte: onlineWindowStart } },
      select: { clientId: true },
      distinct: ["clientId"],
    }),
    prisma.subscriptionAccessLog.findMany({
      where: {
        userAgent: "jboard-agent/xray-access-log",
        allowed: true,
        createdAt: { gte: onlineWindowStart },
        subscriptionId: { not: null },
      },
      select: { userId: true, subscriptionId: true },
    }),
  ]);

  const trafficClientIds = recentTrafficLogs.map((log) => log.clientId);
  const accessSubscriptionIds = recentAccessLogs
    .map((log) => log.subscriptionId)
    .filter((id): id is string => Boolean(id));

  const [trafficClients, accessClients] = await Promise.all([
    trafficClientIds.length
      ? prisma.nodeClient.findMany({
          where: { id: { in: trafficClientIds }, inbound: { serverId: { in: nodeIds } } },
          select: { id: true, userId: true, inbound: { select: { serverId: true } } },
        })
      : [],
    accessSubscriptionIds.length
      ? prisma.nodeClient.findMany({
          where: { subscriptionId: { in: accessSubscriptionIds }, inbound: { serverId: { in: nodeIds } } },
          select: { subscriptionId: true, userId: true, inbound: { select: { serverId: true } } },
        })
      : [],
  ]);

  function addOnlineUser(nodeId: string, userId: string) {
    const users = onlineUsersByNodeId.get(nodeId) ?? new Set<string>();
    users.add(userId);
    onlineUsersByNodeId.set(nodeId, users);
  }

  for (const client of trafficClients) {
    addOnlineUser(client.inbound.serverId, client.userId);
  }

  const accessClientBySubscriptionId = new Map(accessClients.map((client) => [client.subscriptionId, client]));
  for (const log of recentAccessLogs) {
    if (!log.subscriptionId) continue;
    const client = accessClientBySubscriptionId.get(log.subscriptionId);
    if (!client) continue;
    addOnlineUser(client.inbound.serverId, log.userId ?? client.userId);
  }

  return onlineUsersByNodeId;
}
