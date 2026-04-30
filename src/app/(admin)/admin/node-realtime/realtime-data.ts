import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const ONLINE_WINDOW_MS = 2 * 60 * 1000;

const nodeRealtimeSelect = {
  id: true,
  name: true,
  status: true,
  systemMetric: {
    select: {
      inboundBps: true,
      outboundBps: true,
      interfaceName: true,
      sampledAt: true,
      updatedAt: true,
    },
  },
} satisfies Prisma.NodeServerSelect;

type NodeRealtimeBase = Prisma.NodeServerGetPayload<{ select: typeof nodeRealtimeSelect }>;
type RealtimeNodeClient = Prisma.NodeClientGetPayload<{
  select: {
    id: true;
    subscriptionId: true;
    userId: true;
    user: { select: { id: true; email: true; name: true } };
    inbound: {
      select: {
        serverId: true;
        tag: true;
        settings: true;
      };
    };
  };
}>;

export interface NodeRealtimeUserRow {
  id: string;
  email: string;
  name: string | null;
  onlineDeviceCount: number;
  recentSourceIps: string[];
  recentTargetHosts: string[];
  recentInbounds: string[];
  lastActiveAt: Date;
}

export interface NodeRealtimeRow extends NodeRealtimeBase {
  systemMetricFresh: boolean;
  systemMetricHint: string;
  onlineUsers: NodeRealtimeUserRow[];
  onlineUserCount: number;
  onlineDeviceCount: number;
}

export interface NodeRealtimeOverview {
  totalNodes: number;
  reportingNodes: number;
  onlineUsers: number;
  onlineDevices: number;
}

interface OnlineAccumulator {
  id: string;
  email: string;
  name: string | null;
  lastActiveAt: Date;
  sourceIps: Set<string>;
  targetHosts: Set<string>;
  inbounds: Set<string>;
  fallbackActivityCount: number;
}

function parseReasonValue(reason: string | null | undefined, label: string) {
  if (!reason) return null;
  const marker = `${label}：`;
  const start = reason.indexOf(marker);
  if (start < 0) return null;
  const rest = reason.slice(start + marker.length);
  const value = rest.split("；")[0]?.trim();
  return value || null;
}

function pushLimitedUnique(set: Set<string>, value: string | null | undefined, limit = 5) {
  const trimmed = value?.trim();
  if (!trimmed || set.has(trimmed) || set.size >= limit) return;
  set.add(trimmed);
}

function getInboundDisplayName(inbound: { tag: string; settings: unknown } | null | undefined) {
  if (!inbound) return null;
  const settings = inbound.settings;
  if (settings && typeof settings === "object" && !Array.isArray(settings) && "displayName" in settings) {
    const value = (settings as { displayName?: unknown }).displayName;
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return inbound.tag || null;
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

function getSystemMetricHint(metric: NodeRealtimeBase["systemMetric"], now: Date) {
  if (!metric) return "需要升级并运行新版 Agent 后显示整机速度";
  const parts = [
    metric.interfaceName ? `网卡 ${metric.interfaceName}` : null,
    formatRelativeAge(metric.sampledAt, now),
    isMetricFresh(metric.sampledAt, now) ? null : "已过期",
  ].filter(Boolean);
  return parts.join(" · ");
}

function createAccumulator(client: RealtimeNodeClient, activeAt: Date): OnlineAccumulator {
  return {
    id: client.user.id,
    email: client.user.email,
    name: client.user.name,
    lastActiveAt: activeAt,
    sourceIps: new Set<string>(),
    targetHosts: new Set<string>(),
    inbounds: new Set<string>(),
    fallbackActivityCount: 0,
  };
}

function addOnlineActivity(
  onlineByNodeId: Map<string, Map<string, OnlineAccumulator>>,
  nodeId: string,
  client: RealtimeNodeClient,
  activeAt: Date,
  options: {
    sourceIp?: string | null;
    targetHost?: string | null;
    inboundName?: string | null;
    fallbackOnly?: boolean;
  } = {},
) {
  const users = onlineByNodeId.get(nodeId) ?? new Map<string, OnlineAccumulator>();
  const user = users.get(client.user.id) ?? createAccumulator(client, activeAt);

  if (activeAt > user.lastActiveAt) user.lastActiveAt = activeAt;
  if (options.fallbackOnly) user.fallbackActivityCount += 1;
  pushLimitedUnique(user.sourceIps, options.sourceIp);
  pushLimitedUnique(user.targetHosts, options.targetHost);
  pushLimitedUnique(user.inbounds, options.inboundName ?? getInboundDisplayName(client.inbound));

  users.set(client.user.id, user);
  onlineByNodeId.set(nodeId, users);
}

function toOnlineUserRow(user: OnlineAccumulator): NodeRealtimeUserRow {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    onlineDeviceCount: Math.max(user.sourceIps.size, user.fallbackActivityCount > 0 ? 1 : 0),
    recentSourceIps: Array.from(user.sourceIps),
    recentTargetHosts: Array.from(user.targetHosts),
    recentInbounds: Array.from(user.inbounds),
    lastActiveAt: user.lastActiveAt,
  };
}

export async function getNodeRealtimePageData(
  searchParams: Record<string, string | string[] | undefined>,
) {
  const q = typeof searchParams.q === "string" ? searchParams.q.trim() : "";
  const status = typeof searchParams.status === "string" ? searchParams.status : "";
  const now = new Date();
  const onlineWindowStart = new Date(now.getTime() - ONLINE_WINDOW_MS);

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

  const nodes = await prisma.nodeServer.findMany({
    where,
    select: nodeRealtimeSelect,
    orderBy: { createdAt: "desc" },
  });
  const nodeIds = nodes.map((node) => node.id);

  const [recentTrafficLogs, recentAccessLogs] = await Promise.all([
    prisma.trafficLog.findMany({
      where: { timestamp: { gte: onlineWindowStart } },
      select: { clientId: true, timestamp: true },
      orderBy: { timestamp: "desc" },
    }),
    prisma.subscriptionAccessLog.findMany({
      where: {
        userAgent: "jboard-agent/xray-access-log",
        allowed: true,
        createdAt: { gte: onlineWindowStart },
        subscriptionId: { not: null },
      },
      select: {
        subscriptionId: true,
        ip: true,
        reason: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const trafficClientIds = Array.from(new Set(recentTrafficLogs.map((log) => log.clientId)));
  const accessSubscriptionIds = Array.from(new Set(
    recentAccessLogs.map((log) => log.subscriptionId).filter((id): id is string => Boolean(id)),
  ));

  const [trafficClients, accessClients] = await Promise.all([
    trafficClientIds.length
      ? prisma.nodeClient.findMany({
          where: { id: { in: trafficClientIds }, inbound: { serverId: { in: nodeIds } } },
          select: {
            id: true,
            subscriptionId: true,
            userId: true,
            user: { select: { id: true, email: true, name: true } },
            inbound: { select: { serverId: true, tag: true, settings: true } },
          },
        })
      : [],
    accessSubscriptionIds.length
      ? prisma.nodeClient.findMany({
          where: { subscriptionId: { in: accessSubscriptionIds } },
          select: {
            id: true,
            subscriptionId: true,
            userId: true,
            user: { select: { id: true, email: true, name: true } },
            inbound: { select: { serverId: true, tag: true, settings: true } },
          },
        })
      : [],
  ]);

  const trafficClientById = new Map(trafficClients.map((client) => [client.id, client]));
  const accessClientBySubscriptionId = new Map(accessClients.map((client) => [client.subscriptionId, client]));
  const onlineByNodeId = new Map<string, Map<string, OnlineAccumulator>>();
  const allowedNodeIds = new Set(nodeIds);

  const trafficLastSeenByClientId = new Map<string, Date>();
  for (const log of recentTrafficLogs) {
    if (!trafficLastSeenByClientId.has(log.clientId)) {
      trafficLastSeenByClientId.set(log.clientId, log.timestamp);
    }
  }

  for (const [clientId, activeAt] of trafficLastSeenByClientId) {
    const client = trafficClientById.get(clientId);
    if (!client) continue;
    addOnlineActivity(onlineByNodeId, client.inbound.serverId, client, activeAt, { fallbackOnly: true });
  }

  for (const log of recentAccessLogs) {
    if (!log.subscriptionId) continue;
    const client = accessClientBySubscriptionId.get(log.subscriptionId);
    if (!client) continue;
    const parsedNodeId = parseReasonValue(log.reason, "节点");
    const nodeId = parsedNodeId && allowedNodeIds.has(parsedNodeId) ? parsedNodeId : client.inbound.serverId;
    if (!allowedNodeIds.has(nodeId)) continue;

    addOnlineActivity(onlineByNodeId, nodeId, client, log.createdAt, {
      sourceIp: log.ip,
      targetHost: parseReasonValue(log.reason, "样本目标"),
      inboundName: parseReasonValue(log.reason, "入站") ?? getInboundDisplayName(client.inbound),
    });
  }

  const rows: NodeRealtimeRow[] = nodes.map((node) => {
    const onlineUsers = Array.from(onlineByNodeId.get(node.id)?.values() ?? [])
      .map(toOnlineUserRow)
      .sort((a, b) => b.lastActiveAt.getTime() - a.lastActiveAt.getTime());

    return {
      ...node,
      systemMetricFresh: isMetricFresh(node.systemMetric?.sampledAt ?? null, now),
      systemMetricHint: getSystemMetricHint(node.systemMetric, now),
      onlineUsers,
      onlineUserCount: onlineUsers.length,
      onlineDeviceCount: onlineUsers.reduce((sum, user) => sum + user.onlineDeviceCount, 0),
    };
  });

  const overview: NodeRealtimeOverview = {
    totalNodes: rows.length,
    reportingNodes: rows.filter((node) => node.systemMetricFresh).length,
    onlineUsers: rows.reduce((sum, node) => sum + node.onlineUserCount, 0),
    onlineDevices: rows.reduce((sum, node) => sum + node.onlineDeviceCount, 0),
  };

  return {
    nodes: rows,
    filters: { q, status },
    overview,
  };
}
