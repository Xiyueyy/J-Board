"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actorFromSession, recordAuditLog } from "@/services/audit";
import { reconcileProxyPlanSubscriptions } from "@/services/proxy-client-reconcile";
import { deleteSubscriptionPermanently } from "./subscriptions";

const optionalNumber = z.preprocess(
  (value) => (value === "" || value == null ? undefined : Number(value)),
  z.number().optional(),
);
const optionalInt = z.preprocess(
  (value) => (value === "" || value == null ? undefined : Number(value)),
  z.number().int().optional(),
);
const optionalBool = z.preprocess((value) => {
  if (value === "" || value == null) return undefined;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "on";
  }
  return Boolean(value);
}, z.boolean().optional());

const planSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["STREAMING", "PROXY", "BUNDLE"]),
  description: z.string().optional(),
  durationDays: z.coerce.number().int().positive(),
  sortOrder: z.coerce.number().int().default(100),
  isPublic: optionalBool,
  price: optionalNumber,
  nodeId: z.string().optional(),
  inboundId: z.string().optional(),
  inboundIds: z.string().optional(),
  streamingServiceId: z.string().optional(),
  pricingMode: z.enum(["TRAFFIC_SLIDER", "FIXED_PACKAGE"]).optional(),
  fixedTrafficGb: optionalInt,
  fixedPrice: optionalNumber,
  totalLimit: optionalInt,
  perUserLimit: optionalInt,
  totalTrafficGb: optionalInt,
  allowRenewal: optionalBool,
  allowTrafficTopup: optionalBool,
  renewalPrice: optionalNumber,
  renewalPricingMode: z.enum(["PER_DAY", "FIXED_DURATION"]).optional(),
  renewalDurationDays: optionalInt,
  renewalMinDays: optionalInt,
  renewalMaxDays: optionalInt,
  renewalTrafficGb: optionalInt,
  topupPricingMode: z.enum(["PER_GB", "FIXED_AMOUNT"]).optional(),
  topupPricePerGb: optionalNumber,
  topupFixedPrice: optionalNumber,
  minTopupGb: optionalInt,
  maxTopupGb: optionalInt,
  pricePerGb: optionalNumber,
  minTrafficGb: optionalInt,
  maxTrafficGb: optionalInt,
  bundleItems: z.string().optional(),
});

const bundleItemSchema = z.object({
  planId: z.string().trim().min(1),
  selectedInboundId: z.string().trim().optional().nullable(),
  trafficGb: z.coerce.number().int().positive().optional().nullable(),
  sortOrder: z.coerce.number().int().optional().nullable(),
});

type BundleItemInput = z.infer<typeof bundleItemSchema>;

function parseBundleItems(raw: string | undefined): BundleItemInput[] {
  if (!raw?.trim()) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("聚合套餐明细格式错误，请重新选择子套餐");
  }
  const result = z.array(bundleItemSchema).parse(parsed);
  return result.map((item, index) => ({
    ...item,
    selectedInboundId: item.selectedInboundId || null,
    trafficGb: item.trafficGb ?? null,
    sortOrder: item.sortOrder ?? (index + 1) * 10,
  }));
}

async function normalizeBundleItems(items: BundleItemInput[], bundlePlanId?: string) {
  if (items.length === 0) {
    throw new Error("聚合套餐必须至少包含一个子套餐");
  }

  const childPlanIds = Array.from(new Set(items.map((item) => item.planId)));
  if (bundlePlanId && childPlanIds.includes(bundlePlanId)) {
    throw new Error("聚合套餐不能包含自己");
  }

  const plans = await prisma.subscriptionPlan.findMany({
    where: { id: { in: childPlanIds } },
    include: {
      inbound: true,
      inboundOptions: {
        include: { inbound: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  const planMap = new Map(plans.map((plan) => [plan.id, plan]));
  const usedProxyInboundKeys = new Set<string>();
  const usedStreamingPlanIds = new Set<string>();

  return items.map((item, index) => {
    const plan = planMap.get(item.planId);
    if (!plan) throw new Error("聚合套餐包含不存在的子套餐");
    if (!plan.isActive) throw new Error(`${plan.name} 已下架，不能加入聚合套餐`);
    if (plan.type === "BUNDLE") throw new Error("聚合套餐暂不支持嵌套另一个聚合套餐");

    if (plan.type === "STREAMING") {
      if (usedStreamingPlanIds.has(plan.id)) {
        throw new Error(`${plan.name} 已重复添加`);
      }
      usedStreamingPlanIds.add(plan.id);
      return {
        childPlanId: plan.id,
        selectedInboundId: null,
        trafficGb: null,
        sortOrder: item.sortOrder ?? (index + 1) * 10,
      };
    }

    const selectableInbounds = plan.inboundOptions.length > 0
      ? plan.inboundOptions.map((option) => option.inbound).filter((inbound) => inbound.isActive && inbound.serverId === plan.nodeId)
      : (plan.inbound && plan.inbound.isActive && plan.inbound.serverId === plan.nodeId ? [plan.inbound] : []);
    if (selectableInbounds.length === 0) {
      throw new Error(`${plan.name} 没有可用入站，不能加入聚合套餐`);
    }

    const selectedInboundId = item.selectedInboundId || selectableInbounds[0].id;
    const selectedInbound = selectableInbounds.find((inbound) => inbound.id === selectedInboundId);
    if (!selectedInbound) {
      throw new Error(`${plan.name} 的入站无效，请重新选择`);
    }
    const duplicateKey = `${plan.id}:${selectedInboundId}`;
    if (usedProxyInboundKeys.has(duplicateKey)) {
      throw new Error(`${plan.name} 的入站 ${selectedInbound.tag} 已重复添加`);
    }
    usedProxyInboundKeys.add(duplicateKey);

    const trafficGb = plan.pricingMode === "FIXED_PACKAGE"
      ? plan.fixedTrafficGb
      : item.trafficGb;
    if (!trafficGb || trafficGb <= 0) {
      throw new Error(`${plan.name} 需要填写打包流量`);
    }
    if (plan.pricingMode === "TRAFFIC_SLIDER") {
      const minTrafficGb = plan.minTrafficGb ?? 1;
      const maxTrafficGb = plan.maxTrafficGb ?? minTrafficGb;
      if (trafficGb < minTrafficGb || trafficGb > maxTrafficGb) {
        throw new Error(`${plan.name} 的打包流量必须在 ${minTrafficGb}-${maxTrafficGb} GB 之间`);
      }
    }

    return {
      childPlanId: plan.id,
      selectedInboundId,
      trafficGb,
      sortOrder: item.sortOrder ?? (index + 1) * 10,
    };
  });
}

function parseInboundIds(raw: string | undefined, fallbackInboundId?: string): string[] {
  const list = (raw ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (list.length > 0) {
    return Array.from(new Set(list));
  }
  if (fallbackInboundId) {
    return [fallbackInboundId];
  }
  return [];
}

function assertProxyPricing(data: z.infer<typeof planSchema>) {
  const pricingMode = data.pricingMode ?? "TRAFFIC_SLIDER";
  if (pricingMode === "FIXED_PACKAGE") {
    if (data.fixedTrafficGb == null || data.fixedTrafficGb <= 0) {
      throw new Error("固定流量套餐必须填写固定流量");
    }
    if (data.fixedPrice == null || data.fixedPrice < 0) {
      throw new Error("固定流量套餐必须填写固定价格，且不能小于 0");
    }
  } else {
    if (data.pricePerGb == null || data.pricePerGb < 0) {
      throw new Error("自选流量套餐必须填写每 GB 价格，且不能小于 0");
    }
    if (data.minTrafficGb == null || data.minTrafficGb <= 0) {
      throw new Error("自选流量套餐必须填写最小流量");
    }
    if (data.maxTrafficGb == null || data.maxTrafficGb <= 0) {
      throw new Error("自选流量套餐必须填写最大流量");
    }
    if (data.maxTrafficGb < data.minTrafficGb) {
      throw new Error("最大流量不能小于最小流量");
    }
  }
  return pricingMode;
}

type PlanFormData = z.infer<typeof planSchema>;

function getRenewalPolicy(data: PlanFormData, allowRenewal: boolean) {
  if (!allowRenewal) {
    return {
      renewalPrice: null,
      renewalPricingMode: "FIXED_DURATION",
      renewalDurationDays: null,
      renewalMinDays: null,
      renewalMaxDays: null,
    };
  }

  if (data.renewalPrice == null || data.renewalPrice <= 0) {
    throw new Error("开启续费时，续费金额必须大于 0");
  }

  const renewalPricingMode = data.renewalPricingMode ?? "FIXED_DURATION";

  if (renewalPricingMode === "FIXED_DURATION") {
    const renewalDurationDays = data.renewalDurationDays ?? data.durationDays;
    if (!renewalDurationDays || renewalDurationDays <= 0) {
      throw new Error("固定周期续费必须填写续费天数");
    }

    return {
      renewalPrice: data.renewalPrice,
      renewalPricingMode,
      renewalDurationDays,
      renewalMinDays: renewalDurationDays,
      renewalMaxDays: renewalDurationDays,
    };
  }

  const renewalMinDays = data.renewalMinDays ?? 1;
  const renewalMaxDays = data.renewalMaxDays ?? data.durationDays;

  if (renewalMinDays <= 0 || renewalMaxDays <= 0) {
    throw new Error("续费天数范围必须大于 0");
  }
  if (renewalMaxDays < renewalMinDays) {
    throw new Error("续费最大天数不能小于最小天数");
  }

  return {
    renewalPrice: data.renewalPrice,
    renewalPricingMode,
    renewalDurationDays: null,
    renewalMinDays,
    renewalMaxDays,
  };
}

function getTopupPolicy(data: PlanFormData, allowTrafficTopup: boolean) {
  if (data.type !== "PROXY" || !allowTrafficTopup) {
    return {
      topupPricingMode: "PER_GB",
      topupPricePerGb: null,
      topupFixedPrice: null,
      minTopupGb: null,
      maxTopupGb: null,
    };
  }

  const topupPricingMode = data.topupPricingMode ?? "PER_GB";
  if (topupPricingMode === "PER_GB") {
    if (data.topupPricePerGb == null || data.topupPricePerGb <= 0) {
      throw new Error("开启增流量时，每 GB 加流量价格必须大于 0");
    }
  } else if (data.topupFixedPrice == null || data.topupFixedPrice <= 0) {
    throw new Error("开启增流量时，固定加流量金额必须大于 0");
  }

  const minTopupGb = data.minTopupGb ?? 1;
  const maxTopupGb = data.maxTopupGb ?? null;
  if (minTopupGb <= 0) {
    throw new Error("最小增流量必须大于 0");
  }
  if (maxTopupGb != null && maxTopupGb <= 0) {
    throw new Error("最大增流量必须大于 0");
  }
  if (maxTopupGb != null && maxTopupGb < minTopupGb) {
    throw new Error("最大增流量不能小于最小增流量");
  }

  return {
    topupPricingMode,
    topupPricePerGb: topupPricingMode === "PER_GB" ? data.topupPricePerGb : null,
    topupFixedPrice: topupPricingMode === "FIXED_AMOUNT" ? data.topupFixedPrice : null,
    minTopupGb,
    maxTopupGb,
  };
}

export async function createPlan(formData: FormData) {
  const session = await requireAdmin();
  const raw = Object.fromEntries(formData);
  const data = planSchema.parse(raw);
  const allowRenewal = data.allowRenewal ?? false;
  const allowTrafficTopup = data.allowTrafficTopup ?? false;

  if (data.totalLimit != null && data.totalLimit <= 0) {
    throw new Error("总量上限必须大于 0");
  }
  if (data.perUserLimit != null && data.perUserLimit <= 0) {
    throw new Error("每用户限购必须大于 0");
  }
  if (data.totalTrafficGb != null && data.totalTrafficGb <= 0) {
    throw new Error("总流量池必须大于 0");
  }
  const renewalPolicy = getRenewalPolicy(data, allowRenewal);
  const topupPolicy = getTopupPolicy(data, allowTrafficTopup);

  if (data.type === "PROXY") {
    const pricingMode = assertProxyPricing(data);
    if (!data.nodeId) throw new Error("代理套餐必须选择节点");

    const inboundIds = parseInboundIds(data.inboundIds, data.inboundId);
    if (inboundIds.length === 0) {
      throw new Error("请至少配置一个可售入站");
    }

    const inbounds = await prisma.nodeInbound.findMany({
      where: {
        id: { in: inboundIds },
      },
      select: { id: true, serverId: true, isActive: true },
    });
    if (inbounds.length !== inboundIds.length) {
      throw new Error("存在无效入站，请重新选择");
    }
    for (const inbound of inbounds) {
      if (inbound.serverId !== data.nodeId) {
        throw new Error("入站与节点不匹配");
      }
      if (!inbound.isActive) {
        throw new Error("入站未启用");
      }
    }

    let createdPlanId = "";
    await prisma.$transaction(async (tx) => {
      const plan = await tx.subscriptionPlan.create({
        data: {
          name: data.name,
          type: "PROXY",
          description: data.description || null,
          durationDays: data.durationDays,
          sortOrder: data.sortOrder,
          isPublic: data.isPublic ?? true,
          totalLimit: data.totalLimit ?? null,
          perUserLimit: data.perUserLimit ?? null,
          totalTrafficGb: data.totalTrafficGb ?? null,
          allowRenewal,
          allowTrafficTopup,
          renewalPrice: renewalPolicy.renewalPrice,
          renewalPricingMode: renewalPolicy.renewalPricingMode,
          renewalDurationDays: renewalPolicy.renewalDurationDays,
          renewalMinDays: renewalPolicy.renewalMinDays,
          renewalMaxDays: renewalPolicy.renewalMaxDays,
          renewalTrafficGb: null,
          topupPricingMode: topupPolicy.topupPricingMode,
          topupPricePerGb: topupPolicy.topupPricePerGb,
          topupFixedPrice: topupPolicy.topupFixedPrice,
          minTopupGb: topupPolicy.minTopupGb,
          maxTopupGb: topupPolicy.maxTopupGb,
          nodeId: data.nodeId,
          inboundId: inboundIds[0],
          streamingServiceId: null,
          categoryId: null,
          pricingMode,
          fixedTrafficGb: pricingMode === "FIXED_PACKAGE" ? data.fixedTrafficGb : null,
          fixedPrice: pricingMode === "FIXED_PACKAGE" ? data.fixedPrice : null,
          price: null,
          pricePerGb: pricingMode === "TRAFFIC_SLIDER" ? data.pricePerGb : null,
          minTrafficGb: pricingMode === "TRAFFIC_SLIDER" ? data.minTrafficGb : null,
          maxTrafficGb: pricingMode === "TRAFFIC_SLIDER" ? data.maxTrafficGb : null,
        },
      });
      createdPlanId = plan.id;

      await tx.planInboundOption.createMany({
        data: inboundIds.map((inboundId) => ({
          planId: plan.id,
          inboundId,
        })),
      });
    });
    await recordAuditLog({
      actor: actorFromSession(session),
      action: "plan.create",
      targetType: "SubscriptionPlan",
      targetId: createdPlanId,
      targetLabel: data.name,
      message: `创建代理套餐 ${data.name}`,
    });
  } else if (data.type === "STREAMING") {
    if (data.price != null && data.price < 0) {
      throw new Error("流媒体套餐价格不能小于 0");
    }
    if (!data.streamingServiceId) {
      throw new Error("流媒体套餐必须绑定一个流媒体服务");
    }

    const service = await prisma.streamingService.findUnique({
      where: { id: data.streamingServiceId },
      select: { id: true, isActive: true },
    });
    if (!service || !service.isActive) {
      throw new Error("所选流媒体服务不存在或未启用");
    }

    const plan = await prisma.subscriptionPlan.create({
      data: {
        name: data.name,
        type: "STREAMING",
        description: data.description || null,
        durationDays: data.durationDays,
        sortOrder: data.sortOrder,
        isPublic: data.isPublic ?? true,
        totalLimit: data.totalLimit ?? null,
        perUserLimit: data.perUserLimit ?? null,
        totalTrafficGb: null,
        allowRenewal,
        allowTrafficTopup: false,
        renewalPrice: renewalPolicy.renewalPrice,
        renewalPricingMode: renewalPolicy.renewalPricingMode,
        renewalDurationDays: renewalPolicy.renewalDurationDays,
        renewalMinDays: renewalPolicy.renewalMinDays,
        renewalMaxDays: renewalPolicy.renewalMaxDays,
        renewalTrafficGb: null,
        topupPricingMode: "PER_GB",
        topupPricePerGb: null,
        topupFixedPrice: null,
        minTopupGb: null,
        maxTopupGb: null,
        streamingServiceId: data.streamingServiceId,
        categoryId: null,
        pricingMode: "TRAFFIC_SLIDER",
        fixedTrafficGb: null,
        fixedPrice: null,
        price: data.price ?? 0,
        nodeId: null,
        inboundId: null,
        pricePerGb: null,
        minTrafficGb: null,
        maxTrafficGb: null,
      },
    });
    await recordAuditLog({
      actor: actorFromSession(session),
      action: "plan.create",
      targetType: "SubscriptionPlan",
      targetId: plan.id,
      targetLabel: plan.name,
      message: `创建流媒体套餐 ${plan.name}`,
    });
  } else {
    if (data.price == null || data.price < 0) {
      throw new Error("聚合套餐必须填写售价，且不能小于 0");
    }
    const bundleItems = await normalizeBundleItems(parseBundleItems(data.bundleItems));
    const plan = await prisma.subscriptionPlan.create({
      data: {
        name: data.name,
        type: "BUNDLE",
        description: data.description || null,
        durationDays: data.durationDays,
        sortOrder: data.sortOrder,
        isPublic: data.isPublic ?? true,
        totalLimit: data.totalLimit ?? null,
        perUserLimit: data.perUserLimit ?? null,
        totalTrafficGb: null,
        allowRenewal: false,
        allowTrafficTopup: false,
        renewalPrice: null,
        renewalPricingMode: "FIXED_DURATION",
        renewalDurationDays: null,
        renewalMinDays: null,
        renewalMaxDays: null,
        renewalTrafficGb: null,
        topupPricingMode: "PER_GB",
        topupPricePerGb: null,
        topupFixedPrice: null,
        minTopupGb: null,
        maxTopupGb: null,
        streamingServiceId: null,
        categoryId: null,
        pricingMode: "TRAFFIC_SLIDER",
        fixedTrafficGb: null,
        fixedPrice: null,
        price: data.price ?? 0,
        nodeId: null,
        inboundId: null,
        pricePerGb: null,
        minTrafficGb: null,
        maxTrafficGb: null,
        bundleItems: {
          create: bundleItems,
        },
      },
    });
    await recordAuditLog({
      actor: actorFromSession(session),
      action: "plan.create",
      targetType: "SubscriptionPlan",
      targetId: plan.id,
      targetLabel: plan.name,
      message: `创建聚合套餐 ${plan.name}`,
    });
  }
  revalidatePath("/admin/plans");
  revalidatePath("/admin/subscriptions");
  revalidatePath("/admin/online-users");
  revalidatePath("/store");
}

export async function updatePlan(id: string, formData: FormData) {
  const session = await requireAdmin();
  const raw = Object.fromEntries(formData);
  const data = planSchema.parse(raw);
  const allowRenewal = data.allowRenewal ?? false;
  const allowTrafficTopup = data.allowTrafficTopup ?? false;
  const existing = await prisma.subscriptionPlan.findUniqueOrThrow({
    where: { id },
    select: { type: true, nodeId: true },
  });

  if (existing.type !== data.type) {
    throw new Error("暂不支持修改套餐类型，请新建套餐");
  }

  if (data.totalLimit != null && data.totalLimit <= 0) {
    throw new Error("总量上限必须大于 0");
  }
  if (data.perUserLimit != null && data.perUserLimit <= 0) {
    throw new Error("每用户限购必须大于 0");
  }
  if (data.totalTrafficGb != null && data.totalTrafficGb <= 0) {
    throw new Error("总流量池必须大于 0");
  }
  const renewalPolicy = getRenewalPolicy(data, allowRenewal);
  const topupPolicy = getTopupPolicy(data, allowTrafficTopup);

  if (data.type === "PROXY") {
    const pricingMode = assertProxyPricing(data);
    const nodeId = data.nodeId ?? existing.nodeId;

    if (!nodeId) throw new Error("代理套餐必须选择节点");
    if (data.totalTrafficGb == null || data.totalTrafficGb <= 0) {
      throw new Error("代理套餐必须填写总流量池，且大于 0");
    }

    const inboundIds = parseInboundIds(data.inboundIds, data.inboundId);
    if (inboundIds.length === 0) {
      throw new Error("请至少配置一个可售入站");
    }

    const inbounds = await prisma.nodeInbound.findMany({
      where: {
        id: { in: inboundIds },
      },
      select: { id: true, serverId: true, isActive: true },
    });
    if (inbounds.length !== inboundIds.length) {
      throw new Error("存在无效入站，请重新选择");
    }
    for (const inbound of inbounds) {
      if (inbound.serverId !== nodeId) {
        throw new Error("入站与节点不匹配");
      }
      if (!inbound.isActive) {
        throw new Error("入站未启用");
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.subscriptionPlan.update({
        where: { id },
        data: {
          name: data.name,
          description: data.description || null,
          durationDays: data.durationDays,
          sortOrder: data.sortOrder,
          isPublic: data.isPublic ?? true,
          totalLimit: data.totalLimit ?? null,
          perUserLimit: data.perUserLimit ?? null,
          totalTrafficGb: data.totalTrafficGb ?? null,
          allowRenewal,
          allowTrafficTopup,
          renewalPrice: renewalPolicy.renewalPrice,
          renewalPricingMode: renewalPolicy.renewalPricingMode,
          renewalDurationDays: renewalPolicy.renewalDurationDays,
          renewalMinDays: renewalPolicy.renewalMinDays,
          renewalMaxDays: renewalPolicy.renewalMaxDays,
          renewalTrafficGb: null,
          topupPricingMode: topupPolicy.topupPricingMode,
          topupPricePerGb: topupPolicy.topupPricePerGb,
          topupFixedPrice: topupPolicy.topupFixedPrice,
          minTopupGb: topupPolicy.minTopupGb,
          maxTopupGb: topupPolicy.maxTopupGb,
          nodeId,
          inboundId: inboundIds[0],
          streamingServiceId: null,
          categoryId: null,
          pricingMode,
          fixedTrafficGb: pricingMode === "FIXED_PACKAGE" ? data.fixedTrafficGb : null,
          fixedPrice: pricingMode === "FIXED_PACKAGE" ? data.fixedPrice : null,
          price: null,
          pricePerGb: pricingMode === "TRAFFIC_SLIDER" ? data.pricePerGb : null,
          minTrafficGb: pricingMode === "TRAFFIC_SLIDER" ? data.minTrafficGb : null,
          maxTrafficGb: pricingMode === "TRAFFIC_SLIDER" ? data.maxTrafficGb : null,
        },
      });

      await tx.planInboundOption.deleteMany({ where: { planId: id } });
      await tx.planInboundOption.createMany({
        data: inboundIds.map((inboundId) => ({ planId: id, inboundId })),
      });
    });
    const reconcileResult = await reconcileProxyPlanSubscriptions({ planId: id, nodeId, inboundIds });
    await recordAuditLog({
      actor: actorFromSession(session),
      action: "plan.update",
      targetType: "SubscriptionPlan",
      targetId: id,
      targetLabel: data.name,
      message: `更新代理套餐 ${data.name}`,
      metadata: {
        proxyClientReconcile: {
          checked: reconcileResult.checked,
          repaired: reconcileResult.repaired,
          migrated: reconcileResult.migrated,
          kept: reconcileResult.kept,
          skipped: reconcileResult.skipped,
          failed: reconcileResult.failed,
          affectedNodeIds: reconcileResult.affectedNodeIds,
          errors: reconcileResult.errors.map((error) => ({
            subscriptionId: error.subscriptionId,
            message: error.message,
          })),
        },
      },
    });
  } else if (data.type === "STREAMING") {
    if (data.price != null && data.price < 0) {
      throw new Error("流媒体套餐价格不能小于 0");
    }
    if (!data.streamingServiceId) {
      throw new Error("流媒体套餐必须绑定一个流媒体服务");
    }

    const service = await prisma.streamingService.findUnique({
      where: { id: data.streamingServiceId },
      select: { id: true, isActive: true },
    });
    if (!service || !service.isActive) {
      throw new Error("所选流媒体服务不存在或未启用");
    }

    await prisma.subscriptionPlan.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description || null,
        durationDays: data.durationDays,
        sortOrder: data.sortOrder,
        isPublic: data.isPublic ?? true,
        totalLimit: data.totalLimit ?? null,
        perUserLimit: data.perUserLimit ?? null,
        totalTrafficGb: null,
        allowRenewal,
        allowTrafficTopup: false,
        renewalPrice: renewalPolicy.renewalPrice,
        renewalPricingMode: renewalPolicy.renewalPricingMode,
        renewalDurationDays: renewalPolicy.renewalDurationDays,
        renewalMinDays: renewalPolicy.renewalMinDays,
        renewalMaxDays: renewalPolicy.renewalMaxDays,
        renewalTrafficGb: null,
        topupPricingMode: "PER_GB",
        topupPricePerGb: null,
        topupFixedPrice: null,
        minTopupGb: null,
        maxTopupGb: null,
        streamingServiceId: data.streamingServiceId,
        categoryId: null,
        pricingMode: "TRAFFIC_SLIDER",
        fixedTrafficGb: null,
        fixedPrice: null,
        price: data.price ?? 0,
        nodeId: null,
        inboundId: null,
        pricePerGb: null,
        minTrafficGb: null,
        maxTrafficGb: null,
      },
    });

    await prisma.planInboundOption.deleteMany({ where: { planId: id } });
    await recordAuditLog({
      actor: actorFromSession(session),
      action: "plan.update",
      targetType: "SubscriptionPlan",
      targetId: id,
      targetLabel: data.name,
      message: `更新流媒体套餐 ${data.name}`,
    });
  } else {
    if (data.price == null || data.price < 0) {
      throw new Error("聚合套餐必须填写售价，且不能小于 0");
    }
    const bundleItems = await normalizeBundleItems(parseBundleItems(data.bundleItems), id);
    await prisma.$transaction(async (tx) => {
      await tx.subscriptionPlan.update({
        where: { id },
        data: {
          name: data.name,
          description: data.description || null,
          durationDays: data.durationDays,
          sortOrder: data.sortOrder,
          isPublic: data.isPublic ?? true,
          totalLimit: data.totalLimit ?? null,
          perUserLimit: data.perUserLimit ?? null,
          totalTrafficGb: null,
          allowRenewal: false,
          allowTrafficTopup: false,
          renewalPrice: null,
          renewalPricingMode: "FIXED_DURATION",
          renewalDurationDays: null,
          renewalMinDays: null,
          renewalMaxDays: null,
          renewalTrafficGb: null,
          topupPricingMode: "PER_GB",
          topupPricePerGb: null,
          topupFixedPrice: null,
          minTopupGb: null,
          maxTopupGb: null,
          streamingServiceId: null,
          categoryId: null,
          pricingMode: "TRAFFIC_SLIDER",
          fixedTrafficGb: null,
          fixedPrice: null,
          price: data.price,
          nodeId: null,
          inboundId: null,
          pricePerGb: null,
          minTrafficGb: null,
          maxTrafficGb: null,
        },
      });
      await tx.planBundleItem.deleteMany({ where: { bundlePlanId: id } });
      await tx.planBundleItem.createMany({
        data: bundleItems.map((item) => ({ bundlePlanId: id, ...item })),
      });
      await tx.planInboundOption.deleteMany({ where: { planId: id } });
    });
    await recordAuditLog({
      actor: actorFromSession(session),
      action: "plan.update",
      targetType: "SubscriptionPlan",
      targetId: id,
      targetLabel: data.name,
      message: `更新聚合套餐 ${data.name}`,
    });
  }
  revalidatePath("/admin/plans");
  revalidatePath("/admin/subscriptions");
  revalidatePath("/admin/online-users");
  revalidatePath("/store");
}

export async function deletePlan(id: string) {
  const session = await requireAdmin();
  const plan = await prisma.subscriptionPlan.update({
    where: { id },
    data: { isActive: false },
  });
  await recordAuditLog({
    actor: actorFromSession(session),
    action: "plan.disable",
    targetType: "SubscriptionPlan",
    targetId: plan.id,
    targetLabel: plan.name,
    message: `下架套餐 ${plan.name}`,
  });
  revalidatePath("/admin/plans");
  revalidatePath("/store");
}

export async function deletePlanPermanently(id: string) {
  const session = await requireAdmin();
  const actor = actorFromSession(session);
  const plan = await prisma.subscriptionPlan.findUniqueOrThrow({
    where: { id },
    include: {
      inboundOptions: {
        include: {
          inbound: {
            include: {
              _count: {
                select: {
                  clients: true,
                  planOptions: true,
                  plans: true,
                },
              },
            },
          },
        },
      },
      subscriptions: {
        select: { id: true },
      },
    },
  });

  for (const subscription of plan.subscriptions) {
    await deleteSubscriptionPermanently(subscription.id);
  }

  const relatedOrders = await prisma.order.findMany({
    where: { planId: plan.id },
    select: { id: true },
  });

  await prisma.order.deleteMany({
    where: { planId: plan.id },
  });

  const deletableInboundIds: string[] = [];
  for (const option of plan.inboundOptions) {
    const inbound = option.inbound;
    const otherPlanRefs = inbound._count.planOptions - 1;
    const otherPlanDirectRefs = inbound._count.plans - (plan.inboundId === inbound.id ? 1 : 0);
    const hasClients = inbound._count.clients > 0;

    if (otherPlanRefs <= 0 && otherPlanDirectRefs <= 0 && !hasClients) {
      deletableInboundIds.push(inbound.id);
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.planInboundOption.deleteMany({
      where: { planId: plan.id },
    });

    if (deletableInboundIds.length > 0) {
      await tx.nodeInbound.deleteMany({
        where: { id: { in: deletableInboundIds } },
      });
    }

    await tx.subscriptionPlan.delete({
      where: { id: plan.id },
    });
  });

  await recordAuditLog({
    actor,
    action: "plan.delete",
    targetType: "SubscriptionPlan",
    targetId: plan.id,
    targetLabel: plan.name,
    message: `彻底删除套餐 ${plan.name}`,
    metadata: {
      deletedOrderIds: relatedOrders.map((order) => order.id),
      deletedInboundIds: deletableInboundIds,
    },
  });

  revalidatePath("/admin/plans");
  revalidatePath("/store");
  revalidatePath("/admin/subscriptions");
}

export async function togglePlan(id: string, isActive: boolean) {
  const session = await requireAdmin();
  const plan = await prisma.subscriptionPlan.update({
    where: { id },
    data: { isActive },
  });
  await recordAuditLog({
    actor: actorFromSession(session),
    action: isActive ? "plan.enable" : "plan.disable",
    targetType: "SubscriptionPlan",
    targetId: plan.id,
    targetLabel: plan.name,
    message: `${isActive ? "上架" : "下架"}套餐 ${plan.name}`,
  });
  revalidatePath("/admin/plans");
}

export async function batchPlanOperation(formData: FormData) {
  const session = await requireAdmin();
  const action = String(formData.get("action") || "");
  const planIds = formData.getAll("planIds").map(String).filter(Boolean);

  if (planIds.length === 0) {
    throw new Error("请至少选择一个套餐");
  }

  if (action === "enable" || action === "disable") {
    const isActive = action === "enable";
    await prisma.subscriptionPlan.updateMany({
      where: { id: { in: planIds } },
      data: { isActive },
    });

    await recordAuditLog({
      actor: actorFromSession(session),
      action: isActive ? "plan.batch_enable" : "plan.batch_disable",
      targetType: "SubscriptionPlan",
      message: `${isActive ? "批量上架" : "批量下架"} ${planIds.length} 个套餐`,
      metadata: { planIds },
    });
  } else if (action === "delete") {
    for (const planId of planIds) {
      await deletePlanPermanently(planId);
    }
    return;
  } else {
    throw new Error("不支持的批量操作");
  }

  revalidatePath("/admin/plans");
  revalidatePath("/store");
}
