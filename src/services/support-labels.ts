import type { SupportTicketPriority, SupportTicketStatus } from "@prisma/client";

export const supportTicketStatusLabels: Record<SupportTicketStatus, string> = {
  OPEN: "待处理",
  USER_REPLIED: "用户已回复",
  ADMIN_REPLIED: "管理员已回复",
  CLOSED: "已关闭",
};

export const supportTicketPriorityLabels: Record<SupportTicketPriority, string> = {
  LOW: "低",
  NORMAL: "普通",
  HIGH: "高",
  URGENT: "紧急",
};
