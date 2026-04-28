import { prisma } from "@/lib/prisma";
import { bytesToGb, gbToBytes } from "@/lib/utils";
import type { Prisma } from "@prisma/client";

type DbClient = Pick<
  Prisma.TransactionClient,
  "subscriptionPlan" | "userSubscription" | "order" | "orderItem"
>;

const PENDING_ORDER_GRACE_MS = 30 * 60 * 1000;

function getNow() {
  return new Date();
}

export interface PlanTrafficPoolState {
  enabled: boolean;
  totalTrafficGb: number | null;
  totalBytes: bigint;
  allocatedBytes: bigint;
  reservedPendingBytes: bigint;
  remainingBytes: bigint;
  remainingGb: number;
}

export async function getPlanTrafficPoolState(
  planId: string,
  options?: {
    db?: DbClient;
    excludePendingOrderId?: string;
  },
): Promise<PlanTrafficPoolState> {
  const db = options?.db ?? prisma;
  const now = getNow();

  const plan = await db.subscriptionPlan.findUnique({
    where: { id: planId },
    select: {
      type: true,
      totalTrafficGb: true,
    },
  });

  if (!plan || plan.type !== "PROXY" || plan.totalTrafficGb == null) {
    return {
      enabled: false,
      totalTrafficGb: null,
      totalBytes: BigInt(0),
      allocatedBytes: BigInt(0),
      reservedPendingBytes: BigInt(0),
      remainingBytes: BigInt(0),
      remainingGb: 0,
    };
  }

  const totalBytes = gbToBytes(plan.totalTrafficGb);

  const allocatedAgg = await db.userSubscription.aggregate({
    where: {
      planId,
      status: { in: ["ACTIVE", "SUSPENDED"] },
      endDate: { gt: now },
      trafficLimit: { not: null },
    },
    _sum: {
      trafficLimit: true,
    },
  });
  const allocatedBytes = allocatedAgg._sum.trafficLimit ?? BigInt(0);

  const pendingCutoff = new Date(now.getTime() - PENDING_ORDER_GRACE_MS);
  const pendingReservedAgg = await db.order.aggregate({
    where: {
      planId,
      status: "PENDING",
      kind: { in: ["NEW_PURCHASE", "TRAFFIC_TOPUP"] },
      ...(options?.excludePendingOrderId
        ? { id: { not: options.excludePendingOrderId } }
        : {}),
      OR: [
        { expireAt: { gt: now } },
        { AND: [{ expireAt: null }, { createdAt: { gt: pendingCutoff } }] },
      ],
      trafficGb: { not: null },
    },
    _sum: {
      trafficGb: true,
    },
  });

  const pendingItemReservedAgg = await db.orderItem.aggregate({
    where: {
      planId,
      trafficGb: { not: null },
      order: {
        status: "PENDING",
        kind: "NEW_PURCHASE",
        ...(options?.excludePendingOrderId
          ? { id: { not: options.excludePendingOrderId } }
          : {}),
        OR: [
          { expireAt: { gt: now } },
          { AND: [{ expireAt: null }, { createdAt: { gt: pendingCutoff } }] },
        ],
      },
    },
    _sum: {
      trafficGb: true,
    },
  });
  const reservedPendingBytes = gbToBytes(
    (pendingReservedAgg._sum.trafficGb ?? 0) + (pendingItemReservedAgg._sum.trafficGb ?? 0),
  );

  const remainingBytesRaw = totalBytes - allocatedBytes - reservedPendingBytes;
  const remainingBytes =
    remainingBytesRaw > BigInt(0) ? remainingBytesRaw : BigInt(0);

  return {
    enabled: true,
    totalTrafficGb: plan.totalTrafficGb,
    totalBytes,
    allocatedBytes,
    reservedPendingBytes,
    remainingBytes,
    remainingGb: bytesToGb(remainingBytes),
  };
}

export async function ensurePlanTrafficPoolCapacity(
  planId: string,
  requestedGb: number,
  options?: {
    db?: DbClient;
    excludePendingOrderId?: string;
    messagePrefix?: string;
  },
) {
  if (requestedGb <= 0) return;

  const state = await getPlanTrafficPoolState(planId, {
    db: options?.db,
    excludePendingOrderId: options?.excludePendingOrderId,
  });
  if (!state.enabled) return;

  const requestedBytes = gbToBytes(requestedGb);
  if (requestedBytes <= state.remainingBytes) return;

  const prefix = options?.messagePrefix ?? "套餐总流量不足";
  const remainingGb = Math.max(0, Math.floor(state.remainingGb));
  throw new Error(`${prefix}，当前剩余约 ${remainingGb} GB`);
}

export async function ensurePlanTrafficPoolCapacityByBytes(
  planId: string,
  requestedBytes: bigint,
  options?: {
    db?: DbClient;
    excludePendingOrderId?: string;
    messagePrefix?: string;
  },
) {
  if (requestedBytes <= BigInt(0)) return;

  const state = await getPlanTrafficPoolState(planId, {
    db: options?.db,
    excludePendingOrderId: options?.excludePendingOrderId,
  });
  if (!state.enabled) return;
  if (requestedBytes <= state.remainingBytes) return;

  const prefix = options?.messagePrefix ?? "套餐总流量不足";
  const remainingGb = Math.max(0, Math.floor(state.remainingGb));
  throw new Error(`${prefix}，当前剩余约 ${remainingGb} GB`);
}
