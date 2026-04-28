import type { Prisma } from "@prisma/client";
import { prisma, type DbClient } from "@/lib/prisma";
import { createPanelAdapter } from "@/services/node-panel/factory";
import type { PanelClientStat } from "@/services/node-panel/types";

const DEFAULT_STALE_MS = 60 * 1000;

const syncClientInclude = {
  inbound: {
    include: {
      server: true,
    },
  },
  subscription: true,
} satisfies Prisma.NodeClientInclude;

type SyncClient = Prisma.NodeClientGetPayload<{
  include: typeof syncClientInclude;
}>;

export interface TrafficSyncResult {
  scanned: number;
  synced: number;
  skipped: number;
  failed: number;
  uploadDelta: string;
  downloadDelta: string;
  errors: string[];
}

interface SyncTrafficOptions {
  db?: DbClient;
  userId?: string;
  subscriptionId?: string;
  maxAgeMs?: number;
  throwOnError?: boolean;
}

function toBytes(value: unknown): bigint {
  if (typeof value === "bigint") return value > BigInt(0) ? value : BigInt(0);
  if (typeof value === "number" && Number.isFinite(value)) {
    return BigInt(Math.max(0, Math.trunc(value)));
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return BigInt(Math.max(0, Math.trunc(parsed)));
  }
  return BigInt(0);
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function groupClients(clients: SyncClient[]) {
  const groups = new Map<string, SyncClient[]>();
  for (const client of clients) {
    const panelInboundId = client.inbound.panelInboundId;
    if (panelInboundId == null) continue;
    const key = `${client.inbound.serverId}:${panelInboundId}`;
    groups.set(key, [...(groups.get(key) ?? []), client]);
  }
  return groups;
}

async function applyClientTraffic(
  db: DbClient,
  client: SyncClient,
  stat: PanelClientStat,
) {
  const nextUp = toBytes(stat.up);
  const nextDown = toBytes(stat.down);
  const previousUp = client.trafficUp;
  const previousDown = client.trafficDown;
  const uploadDelta = nextUp >= previousUp ? nextUp - previousUp : nextUp;
  const downloadDelta = nextDown >= previousDown ? nextDown - previousDown : nextDown;
  const trafficUsed = nextUp + nextDown;

  await db.nodeClient.update({
    where: { id: client.id },
    data: {
      trafficUp: nextUp,
      trafficDown: nextDown,
      isEnabled: typeof stat.enable === "boolean" ? stat.enable : client.isEnabled,
    },
  });

  await db.userSubscription.update({
    where: { id: client.subscriptionId },
    data: { trafficUsed },
  });

  if (uploadDelta > BigInt(0) || downloadDelta > BigInt(0)) {
    await db.trafficLog.create({
      data: {
        clientId: client.id,
        upload: uploadDelta,
        download: downloadDelta,
      },
    });
  }

  return { uploadDelta, downloadDelta };
}

export async function syncNodeClientTraffic(options: SyncTrafficOptions = {}): Promise<TrafficSyncResult> {
  const db = options.db ?? prisma;
  const staleMs = options.maxAgeMs ?? DEFAULT_STALE_MS;
  const staleBefore = new Date(Date.now() - staleMs);
  const clients = await db.nodeClient.findMany({
    where: {
      ...(options.userId ? { userId: options.userId } : {}),
      ...(options.subscriptionId ? { subscriptionId: options.subscriptionId } : {}),
      updatedAt: { lt: staleBefore },
      inbound: {
        panelInboundId: { not: null },
        server: {
          panelUrl: { not: null },
          panelUsername: { not: null },
          panelPassword: { not: null },
        },
      },
      subscription: {
        status: "ACTIVE",
        endDate: { gt: new Date() },
      },
    },
    include: syncClientInclude,
    orderBy: { updatedAt: "asc" },
  });

  const result: TrafficSyncResult = {
    scanned: clients.length,
    synced: 0,
    skipped: 0,
    failed: 0,
    uploadDelta: "0",
    downloadDelta: "0",
    errors: [],
  };

  const groups = groupClients(clients);
  for (const groupClientsForInbound of groups.values()) {
    const first = groupClientsForInbound[0];
    if (!first || first.inbound.panelInboundId == null) continue;

    try {
      const adapter = createPanelAdapter(first.inbound.server);
      await adapter.login();
      const stats = await adapter.getAllClientTraffics(first.inbound.panelInboundId);
      const statMap = new Map(stats.map((stat) => [normalizeEmail(stat.email), stat]));

      for (const client of groupClientsForInbound) {
        let stat = statMap.get(normalizeEmail(client.email));
        if (!stat) {
          stat = await adapter.getClientTraffic(client.email) ?? undefined;
        }
        if (!stat) {
          result.skipped += 1;
          continue;
        }

        const delta = await applyClientTraffic(db, client, stat);
        result.synced += 1;
        result.uploadDelta = (BigInt(result.uploadDelta) + delta.uploadDelta).toString();
        result.downloadDelta = (BigInt(result.downloadDelta) + delta.downloadDelta).toString();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.failed += groupClientsForInbound.length;
      result.errors.push(`${first.inbound.server.name}: ${message}`);
    }
  }

  if (options.throwOnError && result.errors.length > 0) {
    throw new Error(result.errors.join("；"));
  }

  return result;
}
