"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/require-auth";
import { generateNodeClientCredential } from "@/services/node-client-credential";
import { bytesToGb } from "@/lib/utils";
import { createPanelAdapter } from "@/services/node-panel/factory";
import { createNotification } from "@/services/notifications";
import { recordAuditLog } from "@/services/audit";

function newDownloadToken() {
  return randomUUID().replace(/-/g, "");
}

export async function rotateSubscriptionAccess(subscriptionId: string) {
  const session = await requireAuth();

  const subscription = await prisma.userSubscription.findFirst({
    where: {
      id: subscriptionId,
      userId: session.user.id,
      status: "ACTIVE",
    },
    include: {
      plan: true,
      nodeClient: {
        include: {
          inbound: {
            include: {
              server: true,
            },
          },
        },
      },
    },
  });

  if (!subscription) {
    throw new Error("订阅不存在或不可操作");
  }

  const nextToken = newDownloadToken();
  if (subscription.plan.type === "PROXY" && subscription.nodeClient) {
    const nextCredential = generateNodeClientCredential(
      subscription.nodeClient.inbound.protocol,
      subscription.nodeClient.inbound.settings,
    );
    const panelInboundId = subscription.nodeClient.inbound.panelInboundId;
    if (panelInboundId == null) {
      throw new Error("3x-ui 入站 ID 缺失，请重新同步节点入站");
    }

    const adapter = createPanelAdapter(subscription.nodeClient.inbound.server);
    await adapter.login();
    await adapter.deleteClient(panelInboundId, subscription.nodeClient.uuid);
    await adapter.addClient({
      inboundId: panelInboundId,
      email: subscription.nodeClient.email,
      uuid: nextCredential,
      subId: subscription.id,
      totalGB: subscription.trafficLimit ? bytesToGb(subscription.trafficLimit) : 0,
      expiryTime: subscription.endDate.getTime(),
      protocol: subscription.nodeClient.inbound.protocol,
    });

    await prisma.$transaction(async (tx) => {
      await tx.nodeClient.update({
        where: { id: subscription.nodeClient!.id },
        data: { uuid: nextCredential },
      });
      await tx.userSubscription.update({
        where: { id: subscription.id },
        data: { downloadToken: nextToken },
      });
    });
  } else {
    await prisma.userSubscription.update({
      where: { id: subscription.id },
      data: { downloadToken: nextToken },
    });
  }

  await createNotification({
    userId: subscription.userId,
    type: "SUBSCRIPTION",
    level: "SUCCESS",
    title: "订阅访问已重置",
    body: `${subscription.plan.name} 的订阅链接和访问凭据已更新，旧配置已失效。`,
    link: "/subscriptions",
  });
  await recordAuditLog({
    actor: {
      userId: session.user.id,
      email: session.user.email ?? undefined,
      role: session.user.role === "ADMIN" || session.user.role === "USER" ? session.user.role : undefined,
    },
    action: "subscription.rotate_access",
    targetType: "UserSubscription",
    targetId: subscription.id,
    targetLabel: subscription.plan.name,
    message: `用户重置订阅访问 ${subscription.plan.name}`,
  });

  revalidatePath("/subscriptions");
  revalidatePath(`/subscriptions/${subscriptionId}`);
}
