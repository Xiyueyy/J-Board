import type { SupportTicketPriority, SupportTicketStatus } from "@prisma/client";
import { StatusBadge, type StatusTone } from "@/components/shared/status-badge";
import {
  supportTicketPriorityLabels,
  supportTicketStatusLabels,
} from "@/services/support-labels";

function getSupportTicketStatusTone(status: SupportTicketStatus): StatusTone {
  if (status === "ADMIN_REPLIED") return "success";
  if (status === "USER_REPLIED") return "warning";
  if (status === "OPEN") return "info";
  return "neutral";
}

function getSupportTicketPriorityTone(priority: SupportTicketPriority): StatusTone {
  if (priority === "URGENT") return "danger";
  if (priority === "HIGH") return "warning";
  if (priority === "NORMAL") return "info";
  return "neutral";
}

export function SupportTicketStatusBadge({ status }: { status: SupportTicketStatus }) {
  return (
    <StatusBadge tone={getSupportTicketStatusTone(status)}>
      {supportTicketStatusLabels[status]}
    </StatusBadge>
  );
}

export function SupportTicketPriorityBadge({ priority }: { priority: SupportTicketPriority }) {
  return (
    <StatusBadge tone={getSupportTicketPriorityTone(priority)}>
      {supportTicketPriorityLabels[priority]}
    </StatusBadge>
  );
}
