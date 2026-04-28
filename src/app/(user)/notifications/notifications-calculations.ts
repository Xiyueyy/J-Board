import type { NotificationLevel } from "@prisma/client";
import type { StatusTone } from "@/components/shared/status-badge";

export const notificationLevelLabels: Record<NotificationLevel, string> = {
  INFO: "默认",
  SUCCESS: "成功",
  WARNING: "提醒",
  ERROR: "异常",
};

export function getNotificationLevelTone(level: NotificationLevel): StatusTone {
  if (level === "SUCCESS") return "success";
  if (level === "WARNING") return "warning";
  if (level === "ERROR") return "danger";
  return "neutral";
}

export function getNotificationReadTone(isRead: boolean): StatusTone {
  return isRead ? "neutral" : "info";
}

export function getNotificationReadLabel(isRead: boolean) {
  return isRead ? "已读" : "未读";
}
