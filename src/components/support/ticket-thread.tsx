import { Headphones, UserRound } from "lucide-react";
import { SupportAttachmentList } from "@/components/support/attachment-list";
import { cn, formatDate } from "@/lib/utils";

interface SupportTicketThreadAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
}

interface SupportTicketThreadReply {
  id: string;
  isAdmin: boolean;
  body: string;
  createdAt: Date;
  author?: { email: string } | null;
  attachments: SupportTicketThreadAttachment[];
}

interface SupportTicketThreadProps {
  replies: SupportTicketThreadReply[];
  adminLabel?: string;
  userFallback?: string;
  className?: string;
}

export function SupportTicketThread({
  replies,
  adminLabel = "客服团队",
  userFallback = "用户",
  className,
}: SupportTicketThreadProps) {
  return (
    <section aria-label="工单回复记录" className={cn("space-y-4", className)}>
      {replies.map((reply) => {
        const Icon = reply.isAdmin ? Headphones : UserRound;
        const author = reply.isAdmin ? adminLabel : reply.author?.email ?? userFallback;

        return (
          <article
            key={reply.id}
            className={cn("flex gap-3", reply.isAdmin ? "sm:pl-10" : "sm:pr-10")}
          >
            <span
              className={cn(
                "mt-1 flex size-8 shrink-0 items-center justify-center rounded-lg border",
                reply.isAdmin
                  ? "border-primary/18 bg-primary/10 text-primary"
                  : "border-border bg-muted/35 text-muted-foreground",
              )}
            >
              <Icon className="size-4" />
            </span>
            <div
              className={cn(
                "min-w-0 flex-1 rounded-xl border p-4",
                reply.isAdmin
                  ? "border-primary/20 bg-primary/[0.04]"
                  : "border-border bg-card",
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold">{author}</p>
                <time className="rounded-full bg-background/55 px-2.5 py-1 text-xs text-muted-foreground" dateTime={reply.createdAt.toISOString()}>
                  {formatDate(reply.createdAt)}
                </time>
              </div>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-foreground/82">
                {reply.body}
              </p>
              <SupportAttachmentList items={reply.attachments} />
            </div>
          </article>
        );
      })}
    </section>
  );
}
