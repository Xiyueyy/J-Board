import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { CreateSupportTicketForm } from "./_components/create-support-ticket-form";
import { UserSupportTicketTable } from "./_components/user-support-ticket-table";
import { getUserSupportTickets } from "./support-data";

export const metadata: Metadata = {
  title: "工单售后",
  description: "提交问题并跟踪工单处理进度。",
};

export default async function SupportPage() {
  const session = await getServerSession(authOptions);
  const tickets = await getUserSupportTickets(session!.user.id);

  return (
    <PageShell>
      <PageHeader
        eyebrow="工单售后"
        title="需要帮助？"
      />

      <CreateSupportTicketForm />
      <UserSupportTicketTable tickets={tickets} />
    </PageShell>
  );
}
