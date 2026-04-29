import type {
  AnnouncementAudience,
  AnnouncementDisplayType,
  OrderKind,
  OrderReviewStatus,
  OrderStatus,
  Role,
  SubscriptionStatus,
  SubscriptionType,
  TaskKind,
  TaskStatus,
  UserStatus,
} from "@prisma/client";
import { StatusBadge, type StatusTone } from "@/components/shared/status-badge";

export const orderStatusLabels: Record<OrderStatus, string> = {
  PENDING: "待确认",
  PAID: "已支付",
  CANCELLED: "已取消",
  REFUNDED: "已退款",
};

export const orderKindLabels: Record<OrderKind, string> = {
  NEW_PURCHASE: "新购",
  RENEWAL: "续费",
  TRAFFIC_TOPUP: "增流量",
};

export const orderReviewStatusLabels: Record<OrderReviewStatus, string> = {
  NORMAL: "正常",
  FLAGGED: "异常",
  RESOLVED: "已解决",
};

export const subscriptionStatusLabels: Record<SubscriptionStatus, string> = {
  ACTIVE: "活跃",
  EXPIRED: "已过期",
  CANCELLED: "已取消",
  SUSPENDED: "已暂停",
};

export const subscriptionTypeLabels: Record<SubscriptionType, string> = {
  PROXY: "代理",
  STREAMING: "流媒体",
};

export const userRoleLabels: Record<Role, string> = {
  ADMIN: "管理员",
  USER: "用户",
};

export const userStatusLabels: Record<UserStatus, string> = {
  ACTIVE: "正常",
  PENDING_EMAIL: "待邮箱验证",
  DISABLED: "禁用",
  BANNED: "封禁",
};

export const taskKindLabels: Record<TaskKind, string> = {
  REMINDER_DISPATCH: "提醒派发",
  ORDER_PROVISION_RETRY: "订单重试",
};

export const taskStatusLabels: Record<TaskStatus, string> = {
  PENDING: "待执行",
  RUNNING: "运行中",
  SUCCESS: "成功",
  FAILED: "失败",
};

export const announcementAudienceLabels: Record<AnnouncementAudience, string> = {
  PUBLIC: "公开",
  USERS: "全部用户",
  ADMINS: "全部管理员",
  SPECIFIC_USER: "指定用户",
};

export const announcementDisplayTypeLabels: Record<AnnouncementDisplayType, string> = {
  INLINE: "普通公告",
  BIG: "大公告",
  POPUP: "弹窗公告",
};

export function getOrderStatusTone(status: OrderStatus): StatusTone {
  if (status === "PAID") return "success";
  if (status === "PENDING") return "warning";
  return "danger";
}

export function getOrderReviewStatusTone(status: OrderReviewStatus): StatusTone {
  if (status === "RESOLVED") return "success";
  if (status === "FLAGGED") return "danger";
  return "neutral";
}

export function getSubscriptionStatusTone(status: SubscriptionStatus): StatusTone {
  if (status === "ACTIVE") return "success";
  if (status === "SUSPENDED") return "warning";
  return "neutral";
}

export function getSubscriptionTypeTone(type: SubscriptionType): StatusTone {
  return type === "PROXY" ? "info" : "warning";
}

export function getUserStatusTone(status: UserStatus): StatusTone {
  if (status === "ACTIVE") return "success";
  if (status === "PENDING_EMAIL") return "info";
  if (status === "DISABLED") return "warning";
  return "danger";
}

export function getUserRoleTone(role: Role): StatusTone {
  return role === "ADMIN" ? "info" : "neutral";
}

export function getTaskStatusTone(status: TaskStatus): StatusTone {
  if (status === "SUCCESS") return "success";
  if (status === "FAILED") return "danger";
  if (status === "RUNNING") return "warning";
  return "neutral";
}

export function getAnnouncementAudienceTone(audience: AnnouncementAudience): StatusTone {
  if (audience === "SPECIFIC_USER") return "warning";
  if (audience === "PUBLIC") return "info";
  return "neutral";
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <StatusBadge tone={getOrderStatusTone(status)}>{orderStatusLabels[status]}</StatusBadge>;
}

export function OrderReviewStatusBadge({ status }: { status: OrderReviewStatus }) {
  return (
    <StatusBadge tone={getOrderReviewStatusTone(status)}>
      {orderReviewStatusLabels[status]}
    </StatusBadge>
  );
}

export function SubscriptionStatusBadge({ status }: { status: SubscriptionStatus }) {
  return (
    <StatusBadge tone={getSubscriptionStatusTone(status)}>
      {subscriptionStatusLabels[status]}
    </StatusBadge>
  );
}

export function SubscriptionTypeBadge({ type }: { type: SubscriptionType }) {
  return (
    <StatusBadge tone={getSubscriptionTypeTone(type)}>
      {subscriptionTypeLabels[type]}
    </StatusBadge>
  );
}

export function UserStatusBadge({ status }: { status: UserStatus }) {
  return <StatusBadge tone={getUserStatusTone(status)}>{userStatusLabels[status]}</StatusBadge>;
}

export function UserRoleBadge({ role }: { role: Role }) {
  return <StatusBadge tone={getUserRoleTone(role)}>{userRoleLabels[role]}</StatusBadge>;
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <StatusBadge tone={getTaskStatusTone(status)}>{taskStatusLabels[status]}</StatusBadge>;
}
