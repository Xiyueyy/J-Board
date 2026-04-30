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

const userInclude = {
  subscriptions: {
    where: {
      status: "ACTIVE",
      endDate: { gt: new Date(0) },
    },
    include: activeSubscriptionInclude,
    orderBy: { endDate: "desc" },
  },
} satisfies Prisma.UserInclude;

type UserWithSubscriptions = Prisma.UserGetPayload<{ include: typeof userInclude }>;
type ActiveSubscription = UserWithSubscriptions["subscriptions"][number];
type NodeClientWithNode = NonNullable<ActiveSubscription["nodeClient"]>;

export interface OnlineUsersOverview {
  totalUsers: number;
  onlineUsers: number;
  recentUsers: number;
  activeUsers: number;
}

export interface OnlineUserRow {
  id: string;
  email: string;
  name: string | null;
  userStatus: UserStatus;
  onlineState: OnlineState;
  activeSubscriptionCount: number;
  onlineSourceCount: number;
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

function getInboundDisplayName(inbound: { tag: string; settings: unknown } | null | undefined) {
  if (!inbound) return null;
  const settings = inbound.settings;
  if (settings && typeof settings === "object" && !Array.isArray(settings) && "displayName" in settings) {
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

function getOnlineState(user: UserWithSubscriptions, lastActiveAt: Date | null, now = new Date()): OnlineState {
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
  return subscriptions
    .map((subscription) => subscription.endDate)
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
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
  const online = typeof searchParams.online === "string" ? searchParams.online : "";
  const status = typeof searchParams.status === "string" ? searchParams.status : "";
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
  const activeSubscriptionMap = new Map(activeSubscriptions.map((subscription) => [subscription.id, subscription]));
  const nodeClients = activeSubscriptions
    .map((subscription) => subscription.nodeClient)
    .filter((client): client is NodeClientWithNode => Boolean(client));
  const nodeClientMap = new Map(nodeClients.map((client) => [client.id, client]));
  const clientIds = nodeClients.map((client) => client.id);

  const [latestAccessLogs, latestTrafficLogs, monthlyTrafficGroups, recentAccessLogs] = await Promise.all([
    userIds.length
      ? prisma.subscriptionAccessLog.findMany({
          where: {
            userId: { in: userIds },
            userAgent: "jboard-agent/xray-access-log",
          },
          select: {
            userId: true,
            subscriptionId: true,
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
            ip: true,
          },
        })
      : [],
  ]);

  const accessLogByUserId = new Map(
    latestAccessLogs
      .filter((log) => log.userId)
      .map((log) => [log.userId!, log]),
  );

  const onlineSourceIpsByUserId = new Map<string, Set<string>>();
  for (const log of recentAccessLogs) {
    if (!log.userId || !log.ip) continue;
    const ips = onlineSourceIpsByUserId.get(log.userId) ?? new Set<string>();
    ips.add(log.ip);
    onlineSourceIpsByUserId.set(log.userId, ips);
  }

  const onlineTrafficClientIdsByUserId = new Map<string, Set<string>>();
  const latestTrafficByUserId = new Map<string, { timestamp: Date; client: NodeClientWithNode }>();
  for (const log of latestTrafficLogs) {
    const client = nodeClientMap.get(log.clientId);
    if (!client) continue;
    if (log.timestamp >= onlineWindowStart) {
      const clientIds = onlineTrafficClientIdsByUserId.get(client.userId) ?? new Set<string>();
      clientIds.add(log.clientId);
      onlineTrafficClientIdsByUserId.set(client.userId, clientIds);
    }
    const previous = latestTrafficByUserId.get(client.userId);
    if (!previous || log.timestamp > previous.timestamp) {
      latestTrafficByUserId.set(client.userId, { timestamp: log.timestamp, client });
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
      ? activeSubscriptionMap.get(latestAccess.subscriptionId) ?? null
      : null;

    const lastActiveAt = [latestAccess?.createdAt ?? null, latestTraffic?.timestamp ?? null]
      .filter((date): date is Date => Boolean(date))
      .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
    const lastNodeClient = latestTraffic && (!latestAccess || latestTraffic.timestamp >= latestAccess.createdAt)
      ? latestTraffic.client
      : accessSubscription?.nodeClient ?? latestTraffic?.client ?? null;
    const { nodeName, inboundName } = getNodeClientLabel(lastNodeClient);
    const monthlyUsageBytes = user.subscriptions.reduce((sum, subscription) => {
      const clientId = subscription.nodeClient?.id;
      return clientId ? sum + (monthlyUsageByClientId.get(clientId) ?? BigInt(0)) : sum;
    }, BigInt(0));

    const onlineSourceCount = Math.max(
      onlineSourceIpsByUserId.get(user.id)?.size ?? 0,
      onlineTrafficClientIdsByUserId.get(user.id)?.size ?? 0,
      lastActiveAt && now.getTime() - lastActiveAt.getTime() <= ONLINE_WINDOW_MS ? 1 : 0,
    );

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      userStatus: user.status,
      onlineState: getOnlineState(user, lastActiveAt, now),
      activeSubscriptionCount: user.subscriptions.length,
      onlineSourceCount,
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

  const overview: OnlineUsersOverview = {
    totalUsers: rows.length,
    onlineUsers: rows.filter((row) => row.onlineState === "ONLINE").length,
    recentUsers: rows.filter((row) => row.onlineState === "RECENT").length,
    activeUsers: rows.filter((row) => row.activeSubscriptionCount > 0).length,
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
