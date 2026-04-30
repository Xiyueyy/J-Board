import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { bytesToGb } from "@/lib/utils";
import { generateNodeClientCredential } from "@/services/node-client-credential";
import type { NodePanelAdapter } from "@/services/node-panel/adapter";
import { createPanelAdapter } from "@/services/node-panel/factory";

type TargetInbound = Prisma.NodeInboundGetPayload<{ include: { server: true } }>;
type ReconcileSubscription = Prisma.UserSubscriptionGetPayload<{
  include: {
    user: true;
    nodeClient: {
      include: {
        inbound: {
          include: {
            server: true;
          };
        };
      };
    };
  };
}>;

export interface ProxyPlanClientReconcileResult {
  checked: number;
  repaired: number;
  migrated: number;
  kept: number;
  skipped: number;
  failed: number;
  affectedNodeIds: string[];
  errors: Array<{ subscriptionId: string; message: string }>;
}

interface ReconcileProxyPlanSubscriptionsOptions {
  planId: string;
  nodeId: string;
  inboundIds: string[];
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function getSubscriptionClientEmail(subscription: ReconcileSubscription) {
  return `${subscription.user.email}-${subscription.id.slice(0, 8)}`;
}

function getClientCredential(subscription: ReconcileSubscription, targetInbound: TargetInbound) {
  const currentClient = subscription.nodeClient;
  if (currentClient?.inbound.protocol === targetInbound.protocol) {
    return currentClient.uuid;
  }

  return generateNodeClientCredential(targetInbound.protocol, targetInbound.settings);
}

function orderTargetInbounds(inbounds: TargetInbound[], inboundIds: string[]) {
  const order = new Map(inboundIds.map((inboundId, index) => [inboundId, index]));
  return [...inbounds].sort((a, b) => (order.get(a.id) ?? 9999) - (order.get(b.id) ?? 9999));
}

function chooseTargetInbound(subscription: ReconcileSubscription, targetInbounds: TargetInbound[]) {
  const currentProtocol = subscription.nodeClient?.inbound.protocol;
  if (currentProtocol) {
    const sameProtocolInbound = targetInbounds.find((inbound) => inbound.protocol === currentProtocol);
    if (sameProtocolInbound) return sameProtocolInbound;
  }

  return targetInbounds[0] ?? null;
}

function isClientAlreadyOnAllowedInbound(
  subscription: ReconcileSubscription,
  nodeId: string,
  allowedInboundIds: Set<string>,
) {
  const client = subscription.nodeClient;
  if (!client) return false;

  return client.inbound.serverId === nodeId
    && client.inbound.isActive
    && client.inbound.panelInboundId != null
    && allowedInboundIds.has(client.inboundId);
}

function createEmptyResult(): ProxyPlanClientReconcileResult {
  return {
    checked: 0,
    repaired: 0,
    migrated: 0,
    kept: 0,
    skipped: 0,
    failed: 0,
    affectedNodeIds: [],
    errors: [],
  };
}

function addAffectedNodeId(result: ProxyPlanClientReconcileResult, nodeId: string) {
  if (!result.affectedNodeIds.includes(nodeId)) {
    result.affectedNodeIds.push(nodeId);
  }
}

async function tryDeletePanelClient(adapter: NodePanelAdapter, inbound: TargetInbound, credential: string) {
  if (inbound.panelInboundId == null) return;

  try {
    await adapter.deleteClient(inbound.panelInboundId, credential);
  } catch {
    // 目标客户端可能本来就不存在；这里仅做幂等清理，失败不影响后续重建。
  }
}

async function addPanelClient(
  adapter: NodePanelAdapter,
  inbound: TargetInbound,
  subscription: ReconcileSubscription,
  email: string,
  uuid: string,
) {
  if (inbound.panelInboundId == null) {
    throw new Error(`3x-ui 入站 ID 缺失：${inbound.tag}`);
  }

  await adapter.addClient({
    inboundId: inbound.panelInboundId,
    email,
    uuid,
    subId: subscription.id,
    totalGB: subscription.trafficLimit ? bytesToGb(subscription.trafficLimit) : 0,
    expiryTime: subscription.endDate.getTime(),
    protocol: inbound.protocol,
  });
}

export async function reconcileProxyPlanSubscriptions({
  planId,
  nodeId,
  inboundIds,
}: ReconcileProxyPlanSubscriptionsOptions): Promise<ProxyPlanClientReconcileResult> {
  const result = createEmptyResult();
  const uniqueInboundIds = Array.from(new Set(inboundIds.filter(Boolean)));
  if (uniqueInboundIds.length === 0) return result;

  const targetInbounds = orderTargetInbounds(
    await prisma.nodeInbound.findMany({
      where: {
        id: { in: uniqueInboundIds },
        serverId: nodeId,
        isActive: true,
      },
      include: { server: true },
    }),
    uniqueInboundIds,
  );
  if (targetInbounds.length === 0) return result;

  const allowedInboundIds = new Set(targetInbounds.map((inbound) => inbound.id));
  const subscriptions = await prisma.userSubscription.findMany({
    where: {
      planId,
      status: "ACTIVE",
      endDate: { gt: new Date() },
      plan: { type: "PROXY" },
    },
    include: {
      user: true,
      nodeClient: {
        include: {
          inbound: {
            include: { server: true },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  result.checked = subscriptions.length;
  const adapterByServerId = new Map<string, { adapter: NodePanelAdapter; login: Promise<boolean> }>();

  const getLoggedAdapter = async (inbound: TargetInbound) => {
    let cached = adapterByServerId.get(inbound.serverId);
    if (!cached) {
      const adapter = createPanelAdapter(inbound.server);
      cached = { adapter, login: adapter.login() };
      adapterByServerId.set(inbound.serverId, cached);
    }

    const connected = await cached.login;
    if (!connected) {
      throw new Error(`节点 ${inbound.server.name} 登录失败`);
    }

    return cached.adapter;
  };

  for (const subscription of subscriptions) {
    if (isClientAlreadyOnAllowedInbound(subscription, nodeId, allowedInboundIds)) {
      result.kept += 1;
      continue;
    }

    const targetInbound = chooseTargetInbound(subscription, targetInbounds);
    if (!targetInbound) {
      result.skipped += 1;
      continue;
    }

    try {
      const adapter = await getLoggedAdapter(targetInbound);
      const currentClient = subscription.nodeClient;
      const email = currentClient?.email ?? getSubscriptionClientEmail(subscription);
      const uuid = getClientCredential(subscription, targetInbound);

      await tryDeletePanelClient(adapter, targetInbound, email);
      await tryDeletePanelClient(adapter, targetInbound, uuid);

      try {
        await addPanelClient(adapter, targetInbound, subscription, email, uuid);
      } catch (error) {
        const currentInbound = currentClient?.inbound;
        if (!currentClient || !currentInbound || currentInbound.panelInboundId == null || currentInbound.id === targetInbound.id) {
          throw error;
        }

        const oldAdapter = currentInbound.serverId === targetInbound.serverId
          ? adapter
          : await getLoggedAdapter(currentInbound);
        await tryDeletePanelClient(oldAdapter, currentInbound, currentClient.email);
        await tryDeletePanelClient(oldAdapter, currentInbound, currentClient.uuid);
        await addPanelClient(adapter, targetInbound, subscription, email, uuid);
      }

      if (currentClient) {
        const oldInbound = currentClient.inbound;
        await prisma.nodeClient.update({
          where: { id: currentClient.id },
          data: {
            inboundId: targetInbound.id,
            email,
            uuid,
            expiryTime: subscription.endDate,
            isEnabled: true,
          },
        });

        if (oldInbound.id !== targetInbound.id && oldInbound.panelInboundId != null) {
          const oldAdapter = oldInbound.serverId === targetInbound.serverId
            ? adapter
            : await getLoggedAdapter(oldInbound);
          await tryDeletePanelClient(oldAdapter, oldInbound, currentClient.email);
          await tryDeletePanelClient(oldAdapter, oldInbound, currentClient.uuid);
        }
        result.migrated += 1;
      } else {
        await prisma.nodeClient.create({
          data: {
            inboundId: targetInbound.id,
            userId: subscription.userId,
            subscriptionId: subscription.id,
            email,
            uuid,
            expiryTime: subscription.endDate,
            isEnabled: true,
          },
        });
        result.repaired += 1;
      }

      addAffectedNodeId(result, targetInbound.serverId);
    } catch (error) {
      result.failed += 1;
      result.errors.push({
        subscriptionId: subscription.id,
        message: getErrorMessage(error),
      });
    }
  }

  return result;
}
