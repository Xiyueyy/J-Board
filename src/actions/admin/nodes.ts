"use server";

import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actorFromSession, recordAuditLog } from "@/services/audit";
import { encrypt, isEncryptedValue } from "@/lib/crypto";
import { testAndSyncNodeInbounds } from "@/services/node-panel/sync-inbounds";

const nodeBaseSchema = z.object({
  name: z.string().trim().optional(),
  panelUrl: z.string().trim().min(1, "3x-ui 面板地址必填"),
  panelUsername: z.string().trim().min(1, "3x-ui 用户名必填"),
});

const createNodeSchema = nodeBaseSchema.extend({
  panelPassword: z.string().trim().min(1, "3x-ui 密码必填"),
});

const updateNodeSchema = nodeBaseSchema.extend({
  panelPassword: z.string().trim().optional(),
});

function normalizePanelUrl(raw: string): string {
  try {
    let value = raw.trim();
    if (!/^https?:\/\//i.test(value)) {
      value = `http://${value}`;
    }

    const url = new URL(value);
    let pathname = url.pathname.replace(/\/+$/, "");
    pathname = pathname.replace(/\/panel\/login$/i, "");
    pathname = pathname.replace(/\/panel$/i, "");
    pathname = pathname.replace(/\/login$/i, "");
    return `${url.origin}${pathname}`;
  } catch {
    throw new Error("面板地址格式不正确，请填写 IP:端口 或 http://IP:端口");
  }
}

function parseNodeData(formData: FormData, mode: "create" | "update") {
  const raw = (mode === "create" ? createNodeSchema : updateNodeSchema)
    .parse(Object.fromEntries(formData));
  const panelUrl = normalizePanelUrl(raw.panelUrl);
  const panel = new URL(panelUrl);
  const panelPassword = raw.panelPassword?.trim();

  const name = (raw.name || "").trim() || `节点-${panel.hostname}`;
  return {
    name,
    panelUrl,
    panelUsername: raw.panelUsername,
    ...(panelPassword ? { panelPassword: encrypt(panelPassword) } : {}),
    panelType: "3x-ui",
  };
}

export async function createNode(formData: FormData) {
  const session = await requireAdmin();
  const data = parseNodeData(formData, "create");
  const node = await prisma.nodeServer.create({ data });
  const result = await testAndSyncNodeInbounds(node);

  await recordAuditLog({
    actor: actorFromSession(session),
    action: "node.create",
    targetType: "NodeServer",
    targetId: node.id,
    targetLabel: node.name,
    message: `创建 3x-ui 节点 ${node.name}`,
  });
  revalidatePath("/admin/nodes");
  return {
    ...result,
    message: result.success ? `节点创建成功，${result.message}` : `节点已创建，但${result.message}`,
  };
}

export async function updateNode(id: string, formData: FormData) {
  const session = await requireAdmin();
  const data = parseNodeData(formData, "update");

  if (!data.panelPassword) {
    const existing = await prisma.nodeServer.findUnique({
      where: { id },
      select: { panelPassword: true },
    });
    if (existing?.panelPassword && !isEncryptedValue(existing.panelPassword)) {
      data.panelPassword = encrypt(existing.panelPassword);
    }
  }

  const node = await prisma.nodeServer.update({ where: { id }, data });
  const result = await testAndSyncNodeInbounds(node);

  await recordAuditLog({
    actor: actorFromSession(session),
    action: "node.update",
    targetType: "NodeServer",
    targetId: node.id,
    targetLabel: node.name,
    message: `更新 3x-ui 节点 ${node.name}`,
  });
  revalidatePath("/admin/nodes");
  return {
    ...result,
    message: result.success ? `节点已更新，${result.message}` : `节点已更新，但${result.message}`,
  };
}

export async function deleteNode(id: string) {
  const session = await requireAdmin();
  const node = await prisma.nodeServer.delete({ where: { id } });

  await recordAuditLog({
    actor: actorFromSession(session),
    action: "node.delete",
    targetType: "NodeServer",
    targetId: node.id,
    targetLabel: node.name,
    message: `删除节点 ${node.name}`,
  });
  revalidatePath("/admin/nodes");
}

export async function testNodeConnection(id: string) {
  const session = await requireAdmin();
  const server = await prisma.nodeServer.findUniqueOrThrow({ where: { id } });
  const result = await testAndSyncNodeInbounds(server);

  await recordAuditLog({
    actor: actorFromSession(session),
    action: "node.test",
    targetType: "NodeServer",
    targetId: server.id,
    targetLabel: server.name,
    message: `测试 3x-ui 节点 ${server.name}：${result.message}`,
  });
  revalidatePath("/admin/nodes");
  return result;
}

export async function batchTestNodeConnections(formData: FormData) {
  const nodeIds = formData.getAll("nodeIds").map(String).filter(Boolean);

  if (nodeIds.length === 0) {
    throw new Error("请至少选择一个节点");
  }

  for (const nodeId of nodeIds) {
    await testNodeConnection(nodeId);
  }
}

function withInboundDisplayName(settings: unknown, displayName: string) {
  const base = settings && typeof settings === "object" && !Array.isArray(settings)
    ? settings as Record<string, unknown>
    : {};

  return { ...base, displayName: displayName.trim() };
}

const inboundDisplayNameSchema = z.object({
  displayName: z.string().trim().min(1, "前台名称不能为空").max(60, "前台名称不能超过 60 个字符"),
});

export async function updateInboundDisplayName(id: string, formData: FormData) {
  const session = await requireAdmin();
  const { displayName } = inboundDisplayNameSchema.parse(Object.fromEntries(formData));
  const inbound = await prisma.nodeInbound.findUniqueOrThrow({
    where: { id },
    include: { server: { select: { name: true } } },
  });

  await prisma.nodeInbound.update({
    where: { id },
    data: { settings: withInboundDisplayName(inbound.settings, displayName) },
  });

  await recordAuditLog({
    actor: actorFromSession(session),
    action: "inbound.display_name.update",
    targetType: "NodeInbound",
    targetId: inbound.id,
    targetLabel: displayName,
    message: `更新节点 ${inbound.server.name} 的前台线路名称`,
  });

  revalidatePath("/admin/nodes");
  revalidatePath("/store");
}

export async function deleteInbound(id: string) {
  const session = await requireAdmin();
  const inbound = await prisma.nodeInbound.findUniqueOrThrow({
    where: { id },
    include: {
      server: true,
      _count: {
        select: {
          clients: true,
          plans: true,
          planOptions: true,
          bundleItems: true,
        },
      },
    },
  });

  const referenceCount = inbound._count.clients
    + inbound._count.plans
    + inbound._count.planOptions
    + inbound._count.bundleItems;
  if (referenceCount > 0) {
    throw new Error(
      `这个入站仍被 ${referenceCount} 个套餐或客户端引用，不能直接删除。请先修改相关套餐入站并保存，等待系统迁移已订阅用户后再删除。`,
    );
  }

  await prisma.nodeInbound.delete({ where: { id } });
  await recordAuditLog({
    actor: actorFromSession(session),
    action: "inbound.delete",
    targetType: "NodeInbound",
    targetId: inbound.id,
    targetLabel: `${inbound.protocol}:${inbound.port}`,
    message: `从本地移除节点 ${inbound.server.name} 的入站 ${inbound.protocol}:${inbound.port}`,
  });
  revalidatePath("/admin/nodes");
}

export async function generateAgentToken(nodeId: string) {
  const session = await requireAdmin();
  const node = await prisma.nodeServer.findUniqueOrThrow({
    where: { id: nodeId },
    select: { id: true, name: true },
  });

  const plainToken = crypto.randomBytes(32).toString("hex");
  const encrypted = encrypt(plainToken);

  await prisma.nodeServer.update({
    where: { id: nodeId },
    data: { agentToken: encrypted },
  });

  await recordAuditLog({
    actor: actorFromSession(session),
    action: "node.probe_token.generate",
    targetType: "NodeServer",
    targetId: node.id,
    targetLabel: node.name,
    message: `为节点 ${node.name} 生成探测 Token`,
  });

  revalidatePath("/admin/nodes");
  return plainToken;
}

export async function revokeAgentToken(nodeId: string) {
  const session = await requireAdmin();
  const node = await prisma.nodeServer.findUniqueOrThrow({
    where: { id: nodeId },
    select: { id: true, name: true },
  });

  await prisma.nodeServer.update({
    where: { id: nodeId },
    data: { agentToken: null },
  });

  await recordAuditLog({
    actor: actorFromSession(session),
    action: "node.probe_token.revoke",
    targetType: "NodeServer",
    targetId: node.id,
    targetLabel: node.name,
    message: `撤销节点 ${node.name} 的探测 Token`,
  });

  revalidatePath("/admin/nodes");
}
