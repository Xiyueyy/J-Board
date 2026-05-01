import { isIP } from "node:net";
import type { Prisma, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parsePage } from "@/lib/utils";

const ONLINE_WINDOW_MS = 2 * 60 * 1000;
const RECENT_WINDOW_MS = 10 * 60 * 1000;

type OnlineState = "ONLINE" | "RECENT" | "IDLE" | "INACTIVE" | "DISABLED";

const activeSubscriptionInclude = {
  plan: true,
  nodeClient: {
    include: {
      inbound: {
        include: { server: true },
      },
    },
  },
} satisfies Prisma.UserSubscriptionInclude;

type UserWithSubscriptions = Prisma.UserGetPayload<{
  include: {
    subscriptions: {
      include: typeof activeSubscriptionInclude;
    };
  };
}>;
type ActiveSubscription = UserWithSubscriptions["subscriptions"][number];
type NodeClientWithNode = NonNullable<ActiveSubscription["nodeClient"]>;

export interface OnlineUsersOverview {
  totalUsers: number;
  onlineUsers: number;
  activeNodeConnections: number;
  sourceIpCount: number;
}

export interface OnlineUserRow {
  id: string;
  email: string;
  name: string | null;
  userStatus: UserStatus;
  onlineState: OnlineState;
  activeSubscriptionCount: number;
  activeNodeConnectionCount: number;
  sourceIpCount: number;
  recentSourceIps: string[];
  recentTargetHosts: string[];
  lastNodeName: string | null;
  lastInboundName: string | null;
  lastActiveAt: Date | null;
  monthlyUsageBytes: bigint;
  totalUsedBytes: bigint;
  totalLimitBytes: bigint | null;
  expiresAt: Date | null;
}

function monthStart(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), 1);
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

function pushUniqueValue(
  map: Map<string, string[]>,
  key: string | null | undefined,
  value: string | null | undefined,
  limit = 5,
) {
  if (!key || !value) return;
  const trimmed = value.trim();
  if (!trimmed) return;
  const values = map.get(key) ?? [];
  if (!values.includes(trimmed)) values.push(trimmed);
  if (values.length > limit) values.length = limit;
  map.set(key, values);
}

function normalizeSourceIp(value: string | null | undefined) {
  const trimmed = value
    ?.trim()
    .replace(/^\[|\]$/g, "")
    .toLowerCase();
  return trimmed && isIP(trimmed) !== 0 ? trimmed : null;
}

function ipv6Prefix64(ip: string) {
  const normalized = ip.toLowerCase();
  const head = normalized
    .split("::")[0]
    ?.split(":")
    .filter(Boolean)
    .slice(0, 4)
    .join(":");
  return head || normalized;
}

function sourceIpGroupKeys(sourceIps: Iterable<string>) {
  const ipv4s: string[] = [];
  const ipv6s: string[] = [];

  for (const sourceIp of sourceIps) {
    const version = isIP(sourceIp);
    if (version === 4) ipv4s.push(sourceIp);
    if (version === 6) ipv6s.push(sourceIp);
  }

  const keys = new Set<string>();
  for (const ip of ipv4s) keys.add(`v4:${ip}`);

  if (ipv4s.length === 0) {
    for (const ip of ipv6s) keys.add(`v6:${ipv6Prefix64(ip)}`);
  }

  return keys;
}

function sourceIpGroupCount(sourceIps: Iterable<string>) {
  return sourceIpGroupKeys(sourceIps).size;
}

function addUserSourceKeys(
  target: Set<string>,
  userId: string,
  sourceIps: Iterable<string>,
) {
  for (const key of sourceIpGroupKeys(sourceIps)) {
    target.add(`${userId}:${key}`);
  }
}

function addMapSetValue(
  map: Map<string, Set<string>>,
  key: string | null | undefined,
  value: string | null | undefined,
) {
  if (!key || !value) return;
  const values = map.get(key) ?? new Set<string>();
  values.add(value);
  map.set(key, values);
}

function getInboundDisplayName(
  inbound: { tag: string; settings: unknown } | null | undefined,
) {
  if (!inbound) return null;
  const settings = inbound.settings;
  if (
    settings &&
    typeof settings === "object" &&
    !Array.isArray(settings) &&
    "displayName" in settings
  ) {
    const value = (settings as { displayName?: unknown }).displayName;
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return inbound.tag || null;
}

function getNodeClientLabel(nodeClient: NodeClientWithNode | null | undefined) {
  if (!nodeClient) return { nodeName: null, inboundName: null };
  return {
    nodeName: nodeClient.inbound.server.name,
    inboundName: getInboundDisplayName(nodeClient.inbound),
  };
}

function getOnlineState(
  user: UserWithSubscriptions,
  lastActiveAt: Date | null,
  now = new Date(),
): OnlineState {
  if (user.status !== "ACTIVE") return "DISABLED";
  if (user.subscriptions.length === 0) return "INACTIVE";
  if (!lastActiveAt) return "IDLE";

  const ageMs = now.getTime() - lastActiveAt.getTime();
  if (ageMs <= ONLINE_WINDOW_MS) return "ONLINE";
  if (ageMs <= RECENT_WINDOW_MS) return "RECENT";
  return "IDLE";
}

function sumClientTraffic(subscriptions: ActiveSubscription[]) {
  return subscriptions.reduce((sum, subscription) => {
    const client = subscription.nodeClient;
    if (!client) return sum;
    return sum + client.trafficUp + client.trafficDown;
  }, BigInt(0));
}

function sumTrafficLimit(subscriptions: ActiveSubscription[]) {
  let total = BigInt(0);
  let hasLimitedProxy = false;

  for (const subscription of subscriptions) {
    if (!subscription.nodeClient) continue;
    if (subscription.trafficLimit == null) return null;
    hasLimitedProxy = true;
    total += subscription.trafficLimit;
  }

  return hasLimitedProxy ? total : null;
}

function getMaxExpiry(subscriptions: ActiveSubscription[]) {
  return (
    subscriptions
      .map((subscription) => subscription.endDate)
      .sort((a, b) => b.getTime() - a.getTime())[0] ?? null
  );
}

function paginate<T>(items: T[], page: number, pageSize: number) {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

export async function getOnlineUsersPageData(
  searchParams: Record<string, string | string[] | undefined>,
) {
  const { page, pageSize } = parsePage(searchParams);
  const q = typeof searchParams.q === "string" ? searchParams.q.trim() : "";
  const online =
    typeof searchParams.online === "string" ? searchParams.online : "";
  const status =
    typeof searchParams.status === "string" ? searchParams.status : "";
  const now = new Date();
  const onlineWindowStart = new Date(now.getTime() - ONLINE_WINDOW_MS);

  const where = {
    ...(status ? { status: status as UserStatus } : {}),
    ...(q
      ? {
          OR: [
            { email: { contains: q, mode: "insensitive" as const } },
            { name: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  } satisfies Prisma.UserWhereInput;

  const users = await prisma.user.findMany({
    where,
    include: {
      subscriptions: {
        where: {
          status: "ACTIVE",
          endDate: { gt: now },
        },
        include: activeSubscriptionInclude,
        orderBy: { endDate: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const userIds = users.map((user) => user.id);
  const activeSubscriptions = users.flatMap((user) => user.subscriptions);
  const activeSubscriptionMap = new Map(
    activeSubscriptions.map((subscription) => [subscription.id, subscription]),
  );
  const nodeClients = activeSubscriptions
    .map((subscription) => subscription.nodeClient)
    .filter((client): client is NodeClientWithNode => Boolean(client));
  const nodeClientMap = new Map(
    nodeClients.map((client) => [client.id, client]),
  );
  const clientIds = nodeClients.map((client) => client.id);

  const [
    latestAccessLogs,
    latestTrafficLogs,
    monthlyTrafficGroups,
    recentAccessLogs,
  ] = await Promise.all([
    userIds.length
      ? prisma.subscriptionAccessLog.findMany({
          where: {
            userId: { in: userIds },
            userAgent: "jboard-agent/xray-access-log",
          },
          select: {
            userId: true,
            subscriptionId: true,
            ip: true,
            reason: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          distinct: ["userId"],
        })
      : [],
    clientIds.length
      ? prisma.trafficLog.findMany({
          where: { clientId: { in: clientIds } },
          select: { clientId: true, timestamp: true },
          orderBy: { timestamp: "desc" },
          distinct: ["clientId"],
        })
      : [],
    clientIds.length
      ? prisma.trafficLog.groupBy({
          by: ["clientId"],
          where: {
            clientId: { in: clientIds },
            timestamp: { gte: monthStart(now) },
          },
          _sum: { upload: true, download: true },
        })
      : [],
    userIds.length
      ? prisma.subscriptionAccessLog.findMany({
          where: {
            userId: { in: userIds },
            userAgent: "jboard-agent/xray-access-log",
            allowed: true,
            createdAt: { gte: onlineWindowStart },
          },
          select: {
            userId: true,
            subscriptionId: true,
            ip: true,
            reason: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        })
      : [],
  ]);

  const accessLogByUserId = new Map(
    latestAccessLogs
      .filter((log) => log.userId)
      .map((log) => [log.userId!, log]),
  );

  const onlineSourceIpsByUserId = new Map<string, Set<string>>();
  const recentSourceIpListByUserId = new Map<string, string[]>();
  const recentTargetHostListByUserId = new Map<string, string[]>();
  const activeNodeIdsByUserId = new Map<string, Set<string>>();
  for (const log of recentAccessLogs) {
    if (!log.userId) continue;
    const sourceIp = normalizeSourceIp(log.ip);
    if (sourceIp) {
      addMapSetValue(onlineSourceIpsByUserId, log.userId, sourceIp);
      pushUniqueValue(recentSourceIpListByUserId, log.userId, sourceIp);
    }
    const nodeId =
      parseReasonValue(log.reason, "节点") ??
      (log.subscriptionId
        ? activeSubscriptionMap.get(log.subscriptionId)?.nodeClient?.inbound
            .serverId
        : null) ??
      null;
    addMapSetValue(activeNodeIdsByUserId, log.userId, nodeId);
    pushUniqueValue(
      recentTargetHostListByUserId,
      log.userId,
      parseReasonValue(log.reason, "样本目标"),
    );
  }

  const latestTrafficByUserId = new Map<
    string,
    { timestamp: Date; client: NodeClientWithNode }
  >();
  for (const log of latestTrafficLogs) {
    const client = nodeClientMap.get(log.clientId);
    if (!client) continue;
    if (log.timestamp >= onlineWindowStart) {
      addMapSetValue(
        activeNodeIdsByUserId,
        client.userId,
        client.inbound.serverId,
      );
    }
    const previous = latestTrafficByUserId.get(client.userId);
    if (!previous || log.timestamp > previous.timestamp) {
      latestTrafficByUserId.set(client.userId, {
        timestamp: log.timestamp,
        client,
      });
    }
  }

  const monthlyUsageByClientId = new Map<string, bigint>();
  for (const group of monthlyTrafficGroups) {
    monthlyUsageByClientId.set(
      group.clientId,
      (group._sum.upload ?? BigInt(0)) + (group._sum.download ?? BigInt(0)),
    );
  }

  const rows = users.map<OnlineUserRow>((user) => {
    const latestAccess = accessLogByUserId.get(user.id) ?? null;
    const latestTraffic = latestTrafficByUserId.get(user.id) ?? null;
    const accessSubscription = latestAccess?.subscriptionId
      ? (activeSubscriptionMap.get(latestAccess.subscriptionId) ?? null)
      : null;

    const lastActiveAt =
      [latestAccess?.createdAt ?? null, latestTraffic?.timestamp ?? null]
        .filter((date): date is Date => Boolean(date))
        .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
    const lastNodeClient =
      latestTraffic &&
      (!latestAccess || latestTraffic.timestamp >= latestAccess.createdAt)
        ? latestTraffic.client
        : (accessSubscription?.nodeClient ?? latestTraffic?.client ?? null);
    const { nodeName, inboundName } = getNodeClientLabel(lastNodeClient);
    const monthlyUsageBytes = user.subscriptions.reduce((sum, subscription) => {
      const clientId = subscription.nodeClient?.id;
      return clientId
        ? sum + (monthlyUsageByClientId.get(clientId) ?? BigInt(0))
        : sum;
    }, BigInt(0));

    const sourceIps = onlineSourceIpsByUserId.get(user.id) ?? new Set<string>();
    const sourceIpCount = sourceIpGroupCount(sourceIps);
    const activeNodeConnectionCount =
      activeNodeIdsByUserId.get(user.id)?.size ?? 0;
    const recentSourceIps =
      recentSourceIpListByUserId.get(user.id) ??
      (latestAccess?.ip ? [latestAccess.ip] : []);
    const latestTargetHost = parseReasonValue(latestAccess?.reason, "样本目标");
    const recentTargetHosts =
      recentTargetHostListByUserId.get(user.id) ??
      (latestTargetHost ? [latestTargetHost] : []);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      userStatus: user.status,
      onlineState: getOnlineState(user, lastActiveAt, now),
      activeSubscriptionCount: user.subscriptions.length,
      activeNodeConnectionCount,
      sourceIpCount,
      recentSourceIps,
      recentTargetHosts,
      lastNodeName: nodeName,
      lastInboundName: inboundName,
      lastActiveAt,
      monthlyUsageBytes,
      totalUsedBytes: sumClientTraffic(user.subscriptions),
      totalLimitBytes: sumTrafficLimit(user.subscriptions),
      expiresAt: getMaxExpiry(user.subscriptions),
    };
  });

  const filteredRows = rows.filter((row) => {
    if (!online) return true;
    if (online === "active") return row.activeSubscriptionCount > 0;
    if (online === "online") return row.onlineState === "ONLINE";
    if (online === "recent") return row.onlineState === "RECENT";
    if (online === "idle") return row.onlineState === "IDLE";
    if (online === "inactive") return row.onlineState === "INACTIVE";
    return true;
  });

  filteredRows.sort((a, b) => {
    const rank: Record<OnlineState, number> = {
      ONLINE: 0,
      RECENT: 1,
      IDLE: 2,
      INACTIVE: 3,
      DISABLED: 4,
    };
    const rankDiff = rank[a.onlineState] - rank[b.onlineState];
    if (rankDiff !== 0) return rankDiff;
    return (b.lastActiveAt?.getTime() ?? 0) - (a.lastActiveAt?.getTime() ?? 0);
  });

  const globalSourceKeys = new Set<string>();
  for (const row of rows) {
    addUserSourceKeys(
      globalSourceKeys,
      row.id,
      onlineSourceIpsByUserId.get(row.id) ?? [],
    );
  }

  const overview: OnlineUsersOverview = {
    totalUsers: rows.length,
    onlineUsers: rows.filter((row) => row.onlineState === "ONLINE").length,
    activeNodeConnections: rows.reduce(
      (sum, row) => sum + row.activeNodeConnectionCount,
      0,
    ),
    sourceIpCount: globalSourceKeys.size,
  };

  return {
    users: paginate(filteredRows, page, pageSize),
    total: filteredRows.length,
    page,
    pageSize,
    filters: { q, online, status },
    overview,
  };
}
