"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-auth";
import { actorFromSession, recordAuditLog } from "@/services/audit";
import { createNotification } from "@/services/notifications";
import { createPanelAdapter } from "@/services/node-panel/factory";

async function setProxyClientEnabled(subscriptionId: string, enable: boolean) {
  const client = await prisma.nodeClient.findUnique({
    where: { subscriptionId },
    select: {
      id: true,
      uuid: true,
      inbound: {
        select: {
          serverId: true,
          panelInboundId: true,
          server: true,
        },
      },
    },
  });

  if (!client) {
    return null;
  }

  if (client.inbound.panelInboundId == null) {
    throw new Error("3x-ui 入站 ID 缺失，请重新同步节点入站");
  }

  const adapter = createPanelAdapter(client.inbound.server);
  await adapter.login();
  await adapter.updateClientEnable(client.inbound.panelInboundId, client.uuid, enable);

  await prisma.nodeClient.update({
    where: { id: client.id },
    data: { isEnabled: enable },
  });

  return client.inbound.serverId;
}

async function hardDeleteProxyClient(subscriptionId: string) {
  const client = await prisma.nodeClient.findUnique({
    where: { subscriptionId },
    select: {
      id: true,
      uuid: true,
      inbound: {
        select: {
          serverId: true,
          panelInboundId: true,
          server: true,
        },
      },
    },
  });

  if (!client) {
    return null;
  }

  if (client.inbound.panelInboundId == null) {
    throw new Error("3x-ui 入站 ID 缺失，请重新同步节点入站");
  }

  const adapter = createPanelAdapter(client.inbound.server);
  await adapter.login();
  await adapter.deleteClient(client.inbound.panelInboundId, client.uuid);

  await prisma.nodeClient.delete({
    where: { id: client.id },
  });

  return client.inbound.serverId;
}

async function hardDeleteSubscriptionInternal(
  subscriptionId: string,
  options: {
    actor: ReturnType<typeof actorFromSession>;
    revalidate?: boolean;
  },
) {
  const subscription = await prisma.userSubscription.findUniqueOrThrow({
    where: { id: subscriptionId },
    include: {
      plan: true,
      user: true,
      streamingSlot: true,
    },
  });

  if (subscription.plan.type === "PROXY") {
    await hardDeleteProxyClient(subscription.id);
  }

  await prisma.$transaction(async (tx) => {
    if (subscription.streamingSlot) {
      await tx.streamingSlot.delete({
        where: { id: subscription.streamingSlot.id },
      });

      await tx.streamingService.updateMany({
        where: {
          id: subscription.streamingSlot.serviceId,
          usedSlots: { gt: 0 },
        },
        data: {
          usedSlots: { decrement: 1 },
        },
      });
    }

    await tx.order.deleteMany({
      where: {
        OR: [
          { targetSubscriptionId: subscription.id },
          { subscriptionId: subscription.id },
        ],
      },
    });

    await tx.userSubscription.delete({
      where: { id: subscription.id },
    });
  });

  await createNotification({
    userId: subscription.userId,
    type: "SUBSCRIPTION",
    level: "WARNING",
    title: "订阅已被删除",
    body: `${subscription.plan.name} 已被管理员彻底删除。`,
    link: "/subscriptions",
  });
  await recordAuditLog({
    actor: options.actor,
    action: "subscription.delete",
    targetType: "UserSubscription",
    targetId: subscription.id,
    targetLabel: `${subscription.user.email} / ${subscription.plan.name}`,
    message: `彻底删除订阅 ${subscription.plan.name}`,
  });

  if (options.revalidate !== false) {
    revalidateSubscriptionViews();
  }
}

function revalidateSubscriptionViews() {
  revalidatePath("/admin/subscriptions");
  revalidatePath("/admin/traffic");
  revalidatePath("/subscriptions");
  revalidatePath("/dashboard");
  revalidatePath("/notifications");
}

export async function suspendSubscription(subscriptionId: string) {
  const session = await requireAdmin();

  const subscription = await prisma.userSubscription.findUniqueOrThrow({
    where: { id: subscriptionId },
    include: {
      plan: true,
      user: true,
    },
  });

  if (subscription.status !== "ACTIVE") {
    throw new Error("仅活跃订阅可暂停");
  }

  if (subscription.plan.type === "PROXY") {
    await setProxyClientEnabled(subscription.id, false);
  }

  await prisma.userSubscription.update({
    where: { id: subscription.id },
    data: { status: "SUSPENDED" },
  });

  await createNotification({
    userId: subscription.userId,
    type: "SUBSCRIPTION",
    level: "WARNING",
    title: "订阅已暂停",
    body: `${subscription.plan.name} 已被管理员暂停，如有疑问请联系管理员。`,
    link: "/subscriptions",
  });
  await recordAuditLog({
    actor: actorFromSession(session),
    action: "subscription.suspend",
    targetType: "UserSubscription",
    targetId: subscription.id,
    targetLabel: `${subscription.user.email} / ${subscription.plan.name}`,
    message: `暂停订阅 ${subscription.plan.name}`,
  });

  revalidateSubscriptionViews();
}

export async function activateSubscription(subscriptionId: string) {
  const session = await requireAdmin();

  const subscription = await prisma.userSubscription.findUniqueOrThrow({
    where: { id: subscriptionId },
    include: {
      plan: true,
      user: true,
    },
  });

  if (subscription.status !== "SUSPENDED") {
    throw new Error("仅已暂停订阅可恢复");
  }
  if (subscription.endDate <= new Date()) {
    throw new Error("订阅已过期，无法恢复");
  }

  if (subscription.plan.type === "PROXY") {
    await setProxyClientEnabled(subscription.id, true);
  }

  await prisma.userSubscription.update({
    where: { id: subscription.id },
    data: { status: "ACTIVE" },
  });

  await createNotification({
    userId: subscription.userId,
    type: "SUBSCRIPTION",
    level: "SUCCESS",
    title: "订阅已恢复",
    body: `${subscription.plan.name} 已恢复为可用状态。`,
    link: "/subscriptions",
  });
  await recordAuditLog({
    actor: actorFromSession(session),
    action: "subscription.activate",
    targetType: "UserSubscription",
    targetId: subscription.id,
    targetLabel: `${subscription.user.email} / ${subscription.plan.name}`,
    message: `恢复订阅 ${subscription.plan.name}`,
  });

  revalidateSubscriptionViews();
}

export async function cancelSubscription(subscriptionId: string) {
  const session = await requireAdmin();

  const subscription = await prisma.userSubscription.findUniqueOrThrow({
    where: { id: subscriptionId },
    include: {
      plan: true,
      user: true,
      streamingSlot: true,
    },
  });

  if (subscription.status === "CANCELLED") {
    throw new Error("订阅已取消");
  }

  if (subscription.plan.type === "PROXY") {
    await setProxyClientEnabled(subscription.id, false);
  }

  await prisma.$transaction(async (tx) => {
    if (subscription.streamingSlot) {
      await tx.streamingSlot.delete({
        where: { id: subscription.streamingSlot.id },
      });

      await tx.streamingService.update({
        where: { id: subscription.streamingSlot.serviceId },
        data: {
          usedSlots: {
            decrement: 1,
          },
        },
      });
    }

    await tx.userSubscription.update({
      where: { id: subscription.id },
      data: { status: "CANCELLED" },
    });
  });

  await createNotification({
    userId: subscription.userId,
    type: "SUBSCRIPTION",
    level: "WARNING",
    title: "订阅已取消",
    body: `${subscription.plan.name} 已被管理员取消。`,
    link: "/subscriptions",
  });
  await recordAuditLog({
    actor: actorFromSession(session),
    action: "subscription.cancel",
    targetType: "UserSubscription",
    targetId: subscription.id,
    targetLabel: `${subscription.user.email} / ${subscription.plan.name}`,
    message: `取消订阅 ${subscription.plan.name}`,
  });

  revalidateSubscriptionViews();
}

export async function deleteSubscriptionPermanently(subscriptionId: string) {
  const session = await requireAdmin();
  await hardDeleteSubscriptionInternal(subscriptionId, {
    actor: actorFromSession(session),
  });
}

export async function reassignStreamingSlot(
  subscriptionId: string,
  targetServiceId: string,
) {
  const session = await requireAdmin();

  const subscription = await prisma.userSubscription.findUniqueOrThrow({
    where: { id: subscriptionId },
    include: {
      user: true,
      plan: true,
      streamingSlot: {
        include: {
          service: true,
        },
      },
    },
  });

  if (subscription.plan.type !== "STREAMING") {
    throw new Error("仅流媒体订阅支持调配槽位");
  }
  if (subscription.status === "CANCELLED" || subscription.status === "EXPIRED") {
    throw new Error("当前订阅状态不支持调配槽位");
  }

  const targetService = await prisma.streamingService.findUniqueOrThrow({
    where: { id: targetServiceId },
    select: {
      id: true,
      name: true,
      isActive: true,
      usedSlots: true,
      maxSlots: true,
    },
  });

  if (!targetService.isActive) {
    throw new Error("目标流媒体服务未启用");
  }
  if (subscription.streamingSlot?.serviceId === targetService.id) {
    throw new Error("已在当前服务上，无需重复调配");
  }
  if (targetService.usedSlots >= targetService.maxSlots) {
    throw new Error("目标流媒体服务已满");
  }

  await prisma.$transaction(async (tx) => {
    if (subscription.streamingSlot) {
      await tx.streamingSlot.update({
        where: { id: subscription.streamingSlot.id },
        data: {
          serviceId: targetService.id,
          assignedAt: new Date(),
        },
      });
      await tx.streamingService.updateMany({
        where: {
          id: subscription.streamingSlot.serviceId,
          usedSlots: { gt: 0 },
        },
        data: {
          usedSlots: { decrement: 1 },
        },
      });
      await tx.streamingService.update({
        where: { id: targetService.id },
        data: {
          usedSlots: { increment: 1 },
        },
      });
    } else {
      await tx.streamingSlot.create({
        data: {
          subscriptionId: subscription.id,
          userId: subscription.userId,
          serviceId: targetService.id,
        },
      });
      await tx.streamingService.update({
        where: { id: targetService.id },
        data: {
          usedSlots: { increment: 1 },
        },
      });
    }
  });

  await createNotification({
    userId: subscription.userId,
    type: "SUBSCRIPTION",
    level: "INFO",
    title: "流媒体服务已调整",
    body: `${subscription.plan.name} 已调整到服务 ${targetService.name}。`,
    link: "/subscriptions",
  });
  await recordAuditLog({
    actor: actorFromSession(session),
    action: "streaming-slot.reassign",
    targetType: "StreamingSlot",
    targetId: subscription.streamingSlot?.id ?? subscription.id,
    targetLabel: `${subscription.user.email} / ${subscription.plan.name}`,
    message: `将流媒体订阅 ${subscription.plan.name} 调配到 ${targetService.name}`,
  });

  revalidateSubscriptionViews();
  revalidatePath("/admin/services");
}

export async function batchSubscriptionOperation(formData: FormData) {
  const action = String(formData.get("action") || "");
  const subscriptionIds = formData.getAll("subscriptionIds").map(String).filter(Boolean);

  if (subscriptionIds.length === 0) {
    throw new Error("请至少选择一个订阅");
  }

  for (const subscriptionId of subscriptionIds) {
    if (action === "suspend") {
      await suspendSubscription(subscriptionId);
    } else if (action === "activate") {
      await activateSubscription(subscriptionId);
    } else if (action === "cancel") {
      await cancelSubscription(subscriptionId);
    } else if (action === "delete") {
      await deleteSubscriptionPermanently(subscriptionId);
    } else {
      throw new Error("不支持的批量操作");
    }
  }
}
