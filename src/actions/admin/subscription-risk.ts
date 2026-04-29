"use server";

import { revalidatePath } from "next/cache";
import type {
  SubscriptionRiskFinalAction,
  SubscriptionRiskReviewStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-auth";
import { actorFromSession, recordAuditLog } from "@/services/audit";
import { createNotification } from "@/services/notifications";
import {
  buildSubscriptionRiskReport,
  getSubscriptionRiskAccessLogsForEvent,
  reasonLabel,
  riskKindLabel,
} from "@/services/subscription-risk-review";
import { activateSubscription } from "./subscriptions";

const REVIEW_STATUSES = ["OPEN", "ACKNOWLEDGED", "RESOLVED"] as const;
const FINAL_ACTIONS = ["RESTORE_ACCESS", "KEEP_RESTRICTED"] as const;

function assertReviewStatus(status: string): asserts status is SubscriptionRiskReviewStatus {
  if (!REVIEW_STATUSES.includes(status as SubscriptionRiskReviewStatus)) {
    throw new Error("不支持的处理状态");
  }
}

function assertFinalAction(action: string): asserts action is SubscriptionRiskFinalAction {
  if (!FINAL_ACTIONS.includes(action as SubscriptionRiskFinalAction)) {
    throw new Error("不支持的最终处置");
  }
}

function reviewStatusLabel(status: SubscriptionRiskReviewStatus) {
  switch (status) {
    case "OPEN":
      return "待处理";
    case "ACKNOWLEDGED":
      return "已确认";
    case "RESOLVED":
      return "已解决";
  }
}

function finalActionLabel(action: SubscriptionRiskFinalAction) {
  switch (action) {
    case "RESTORE_ACCESS":
      return "解除限制";
    case "KEEP_RESTRICTED":
      return "保持限制";
  }
}

function normalizeNote(note: string | null | undefined) {
  const value = note?.trim();
  return value ? value.slice(0, 1000) : null;
}

function revalidateRiskViews(subscriptionId?: string | null, userId?: string | null) {
  revalidatePath("/admin/subscription-risk");
  revalidatePath("/admin/audit-logs");
  revalidatePath("/admin/subscriptions");
  revalidatePath("/admin/users");
  revalidatePath("/dashboard");
  revalidatePath("/support");
  revalidatePath("/notifications");
  if (subscriptionId) revalidatePath(`/admin/subscriptions/${subscriptionId}`);
  if (userId) revalidatePath(`/admin/users/${userId}`);
}

async function getRiskTargetLabel(input: {
  userId?: string | null;
  subscriptionId?: string | null;
}) {
  if (input.subscriptionId) {
    const subscription = await prisma.userSubscription.findUnique({
      where: { id: input.subscriptionId },
      select: {
        plan: { select: { name: true } },
        user: { select: { email: true } },
      },
    });

    if (subscription) return `${subscription.user.email} / ${subscription.plan.name}`;
  }

  if (input.userId) {
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { email: true },
    });
    return user?.email ?? input.userId;
  }

  return null;
}

async function getRiskEventContext(eventId: string) {
  const event = await prisma.subscriptionRiskEvent.findUniqueOrThrow({
    where: { id: eventId },
  });

  const [user, subscription, logs] = await Promise.all([
    event.userId
      ? prisma.user.findUnique({
          where: { id: event.userId },
          select: { id: true, email: true, name: true, status: true, createdAt: true },
        })
      : Promise.resolve(null),
    event.subscriptionId
      ? prisma.userSubscription.findUnique({
          where: { id: event.subscriptionId },
          select: {
            id: true,
            status: true,
            endDate: true,
            plan: { select: { name: true, type: true } },
          },
        })
      : Promise.resolve(null),
    getSubscriptionRiskAccessLogsForEvent(event),
  ]);

  return { event, user, subscription, logs };
}

async function buildAndSaveRiskReport(eventId: string) {
  const { event, user, subscription, logs } = await getRiskEventContext(eventId);
  const report = buildSubscriptionRiskReport({ event, user, subscription, logs });
  const updated = await prisma.subscriptionRiskEvent.update({
    where: { id: event.id },
    data: {
      riskReport: report,
      reportGeneratedAt: new Date(),
    },
  });

  return { event: updated, user, subscription, logs, report };
}

async function notifyUserWithRiskReport(input: {
  eventId: string;
  userId: string;
}) {
  await createNotification({
    userId: input.userId,
    type: "SUBSCRIPTION",
    level: "ERROR",
    title: "订阅风控处理通知",
    body: "你的订阅访问存在异常地区/IP 记录，账户操作已临时限制。请新建工单联系客服核验。",
    link: `/support?riskEventId=${input.eventId}`,
    dedupeKey: `risk:report-sent:${input.eventId}`,
  });
}

async function restoreSubscriptionsForEvent(event: {
  userId: string | null;
  subscriptionId: string | null;
  kind: "SINGLE" | "AGGREGATE";
}) {
  const now = new Date();

  if (event.kind === "SINGLE" && event.subscriptionId) {
    const subscription = await prisma.userSubscription.findUnique({
      where: { id: event.subscriptionId },
      select: { id: true, status: true, endDate: true },
    });
    if (subscription?.status === "SUSPENDED" && subscription.endDate > now) {
      await activateSubscription(subscription.id);
      return [subscription.id];
    }
    return [];
  }

  if (event.kind === "AGGREGATE" && event.userId) {
    const subscriptions = await prisma.userSubscription.findMany({
      where: {
        userId: event.userId,
        status: "SUSPENDED",
        endDate: { gt: now },
        plan: { type: "PROXY" },
      },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    });

    const restoredIds: string[] = [];
    for (const subscription of subscriptions) {
      await activateSubscription(subscription.id);
      restoredIds.push(subscription.id);
    }
    return restoredIds;
  }

  return [];
}

export async function updateSubscriptionRiskReview(
  eventId: string,
  status: SubscriptionRiskReviewStatus,
  note?: string,
  options: { restoreSubscription?: boolean } = {},
) {
  assertReviewStatus(status);
  const session = await requireAdmin();
  const actor = actorFromSession(session);
  const event = await prisma.subscriptionRiskEvent.findUniqueOrThrow({
    where: { id: eventId },
    select: {
      id: true,
      userId: true,
      subscriptionId: true,
      kind: true,
      level: true,
      reason: true,
      message: true,
      reviewStatus: true,
    },
  });

  if (options.restoreSubscription) {
    if (status !== "RESOLVED") {
      throw new Error("只有标记已解决时才能恢复订阅");
    }
    if (!event.subscriptionId) {
      throw new Error("该风控事件没有关联单个订阅，请到订阅详情中逐个恢复");
    }
    await activateSubscription(event.subscriptionId);
  }

  const normalizedNote = normalizeNote(note);
  const reviewedAt = new Date();
  await prisma.subscriptionRiskEvent.update({
    where: { id: event.id },
    data: {
      reviewStatus: status,
      reviewNote: normalizedNote,
      reviewedAt,
      reviewedById: actor.userId ?? null,
      reviewedByEmail: actor.email ?? null,
      ...(status === "RESOLVED"
        ? {
            userRestrictionActive: false,
            userRestrictionResolvedAt: reviewedAt,
          }
        : {}),
    },
  });

  const targetLabel = await getRiskTargetLabel({
    userId: event.userId,
    subscriptionId: event.subscriptionId,
  });

  await recordAuditLog({
    actor,
    action: "risk.subscription.review",
    targetType: event.subscriptionId ? "UserSubscription" : "User",
    targetId: event.subscriptionId ?? event.userId ?? event.id,
    targetLabel,
    message: `将订阅风控事件标记为${reviewStatusLabel(status)}`,
    metadata: {
      eventId: event.id,
      oldReviewStatus: event.reviewStatus,
      newReviewStatus: status,
      restoreSubscription: options.restoreSubscription === true,
      note: normalizedNote,
      kind: event.kind,
      level: event.level,
      reason: event.reason,
    },
  });

  revalidateRiskViews(event.subscriptionId, event.userId);
  return { ok: true };
}

export async function generateSubscriptionRiskReport(eventId: string) {
  const session = await requireAdmin();
  const actor = actorFromSession(session);
  const { event, report } = await buildAndSaveRiskReport(eventId);
  const targetLabel = await getRiskTargetLabel({
    userId: event.userId,
    subscriptionId: event.subscriptionId,
  });

  await recordAuditLog({
    actor,
    action: "risk.subscription.report.generate",
    targetType: event.subscriptionId ? "UserSubscription" : "User",
    targetId: event.subscriptionId ?? event.userId ?? event.id,
    targetLabel,
    message: "生成订阅风控风险报告",
    metadata: {
      eventId: event.id,
      kind: event.kind,
      level: event.level,
      reason: event.reason,
      reportLength: report.length,
    },
  });

  revalidateRiskViews(event.subscriptionId, event.userId);
  return { ok: true, report };
}

export async function sendSubscriptionRiskReport(eventId: string) {
  const session = await requireAdmin();
  const actor = actorFromSession(session);
  let { event, user, report } = await getRiskEventContext(eventId).then((context) => ({
    event: context.event,
    user: context.user,
    report: context.event.riskReport,
  }));

  if (!event.userId || !user) {
    throw new Error("该风控事件没有关联用户，无法发送用户通知");
  }
  const reportUserId = event.userId;

  if (!report) {
    const generated = await buildAndSaveRiskReport(event.id);
    event = generated.event;
    user = generated.user;
    report = generated.report;
  }

  const now = new Date();
  await prisma.subscriptionRiskEvent.update({
    where: { id: event.id },
    data: {
      reportSentAt: now,
      userRestrictionActive: true,
      reviewStatus: event.reviewStatus === "OPEN" ? "ACKNOWLEDGED" : event.reviewStatus,
      reviewedAt: event.reviewStatus === "OPEN" ? now : event.reviewedAt,
      reviewedById: event.reviewStatus === "OPEN" ? actor.userId ?? null : event.reviewedById,
      reviewedByEmail: event.reviewStatus === "OPEN" ? actor.email ?? null : event.reviewedByEmail,
    },
  });

  await notifyUserWithRiskReport({ eventId: event.id, userId: reportUserId });

  const targetLabel = await getRiskTargetLabel({
    userId: event.userId,
    subscriptionId: event.subscriptionId,
  });

  await recordAuditLog({
    actor,
    action: "risk.subscription.report.send",
    targetType: event.subscriptionId ? "UserSubscription" : "User",
    targetId: event.subscriptionId ?? event.userId ?? event.id,
    targetLabel,
    message: `向用户发送订阅风控报告并启用强制通知：${user?.email ?? event.userId}`,
    metadata: {
      eventId: event.id,
      reason: event.reason,
      riskReasonLabel: reasonLabel(event.reason),
      riskKind: riskKindLabel(event.kind),
    },
  });

  revalidateRiskViews(event.subscriptionId, event.userId);
  return { ok: true };
}

export async function finalizeSubscriptionRiskDecision(
  eventId: string,
  action: SubscriptionRiskFinalAction,
  note?: string,
  options: { notifyUser?: boolean } = {},
) {
  assertFinalAction(action);
  const session = await requireAdmin();
  const actor = actorFromSession(session);
  let { event, report } = await getRiskEventContext(eventId).then((context) => ({
    event: context.event,
    report: context.event.riskReport,
  }));

  if (options.notifyUser && !event.userId) {
    throw new Error("该风控事件没有关联用户，无法发送用户通知");
  }

  if (options.notifyUser && !report) {
    const generated = await buildAndSaveRiskReport(event.id);
    event = generated.event;
    report = generated.report;
  }

  const restoredSubscriptionIds = action === "RESTORE_ACCESS"
    ? await restoreSubscriptionsForEvent(event)
    : [];
  const normalizedNote = normalizeNote(note);
  const now = new Date();
  const shouldKeepRestriction = action === "KEEP_RESTRICTED" && (event.userRestrictionActive || options.notifyUser);

  await prisma.subscriptionRiskEvent.update({
    where: { id: event.id },
    data: {
      reviewStatus: "RESOLVED",
      reviewNote: normalizedNote,
      reviewedAt: now,
      reviewedById: actor.userId ?? null,
      reviewedByEmail: actor.email ?? null,
      finalAction: action,
      finalActionAt: now,
      finalActionById: actor.userId ?? null,
      finalActionByEmail: actor.email ?? null,
      userRestrictionActive: shouldKeepRestriction,
      userRestrictionResolvedAt: action === "RESTORE_ACCESS" ? now : event.userRestrictionResolvedAt,
      ...(options.notifyUser
        ? {
            reportSentAt: event.reportSentAt ?? now,
          }
        : {}),
    },
  });

  if (action === "RESTORE_ACCESS" && event.userId) {
    await createNotification({
      userId: event.userId,
      type: "SUBSCRIPTION",
      level: "SUCCESS",
      title: "订阅风控限制已解除",
      body: "管理员已完成订阅风控复核，你的账户操作限制已解除。",
      link: "/subscriptions",
      dedupeKey: `risk:restriction-restored:${event.id}`,
    });
  }

  if (action === "KEEP_RESTRICTED" && options.notifyUser && event.userId && report) {
    await notifyUserWithRiskReport({ eventId: event.id, userId: event.userId });
  }

  const targetLabel = await getRiskTargetLabel({
    userId: event.userId,
    subscriptionId: event.subscriptionId,
  });

  await recordAuditLog({
    actor,
    action: "risk.subscription.finalize",
    targetType: event.subscriptionId ? "UserSubscription" : "User",
    targetId: event.subscriptionId ?? event.userId ?? event.id,
    targetLabel,
    message: `订阅风控最终处置：${finalActionLabel(action)}`,
    metadata: {
      eventId: event.id,
      finalAction: action,
      notifyUser: options.notifyUser === true,
      note: normalizedNote,
      restoredSubscriptionIds,
    },
  });

  revalidateRiskViews(event.subscriptionId, event.userId);
  return { ok: true, restoredSubscriptionIds };
}
