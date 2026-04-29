import type { Metadata } from "next";
import { getActiveSession } from "@/lib/require-auth";
import { notFound } from "next/navigation";
import { PageHeader, PageShell } from "@/components/shared/page-shell";
import {
  SupportTicketPriorityBadge,
  SupportTicketStatusBadge,
} from "@/components/support/ticket-badges";
import { UserSupportTicketActions } from "@/components/support/user-ticket-actions";
import { formatDate } from "@/lib/utils";
import { SupportTicketReplyForm } from "../_components/support-ticket-reply-form";
import { SupportTicketThread } from "../_components/support-ticket-thread";
import { getUserSupportTicketDetail } from "../support-data";

export const metadata: Metadata = {
  title: "工单详情",
  description: "查看工单会话并继续回复。",
};

export default async function SupportTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getActiveSession();
  const { id } = await params;
  const ticket = await getUserSupportTicketDetail({
    ticketId: id,
    userId: session!.user.id,
  });

  if (!ticket) {
    notFound();
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="工单详情"
        title={ticket.subject}
        description={`创建于 ${formatDate(ticket.createdAt)}，最近更新 ${formatDate(ticket.updatedAt)}。`}
        actions={
          <UserSupportTicketActions
            ticketId={ticket.id}
            status={ticket.status}
            redirectAfterDelete="/support"
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

      <SupportTicketThread replies={ticket.replies} />

      {ticket.status !== "CLOSED" && <SupportTicketReplyForm ticketId={ticket.id} />}
    </PageShell>
  );
}
