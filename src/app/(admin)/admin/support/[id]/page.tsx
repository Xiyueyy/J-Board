import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader, PageShell } from "@/components/shared/page-shell";
import {
  SupportTicketPriorityBadge,
  SupportTicketStatusBadge,
} from "@/components/support/ticket-badges";
import { SupportTicketThread } from "@/components/support/ticket-thread";
import { AdminSupportTicketActions } from "@/components/support/admin-ticket-actions";
import { formatDate } from "@/lib/utils";
import { AdminSupportReplyForm } from "../_components/admin-support-reply-form";
import { SupportTicketMetaForm } from "../_components/support-ticket-meta-form";
import { getAdminSupportTicketDetail } from "../support-data";

export const metadata: Metadata = {
  title: "工单详情",
  description: "查看并处理指定工单会话。",
};

export default async function AdminSupportTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ticket = await getAdminSupportTicketDetail(id);

  if (!ticket) {
    notFound();
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="工单详情"
        title={ticket.subject}
        description={`用户 ${ticket.user.email} · 创建于 ${formatDate(ticket.createdAt)} · 最近更新 ${formatDate(ticket.updatedAt)}`}
        actions={
          <AdminSupportTicketActions
            ticketId={ticket.id}
            redirectAfterDelete="/admin/support"
          />
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <SupportTicketStatusBadge status={ticket.status} />
        <SupportTicketPriorityBadge priority={ticket.priority} />
        {ticket.category && (
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {ticket.category}
          </span>
        )}
      </div>

      <SupportTicketMetaForm ticket={ticket} />
      <SupportTicketThread replies={ticket.replies} adminLabel="管理员" />
      {ticket.status !== "CLOSED" && <AdminSupportReplyForm ticketId={ticket.id} />}
    </PageShell>
  );
}
