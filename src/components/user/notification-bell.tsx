import Link from "next/link";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";

export function NotificationBell({ unreadCount = 0, className }: { unreadCount?: number; className?: string }) {
  const hasUnread = unreadCount > 0;

  return (
    <Link
      href="/notifications"
      aria-label={hasUnread ? `${unreadCount} 条未读消息` : "消息中心"}
      className={cn(
        "btn-base btn-cream relative inline-flex size-11 items-center justify-center rounded-2xl",
        hasUnread && "border-primary/20 bg-primary/10 text-primary shadow-[var(--shadow-button)]",
        className,
      )}
    >
      <Bell className={cn("size-4", hasUnread && "animate-pulse")} />
      {hasUnread && (
        <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[0.65rem] font-bold text-primary-foreground shadow-[0_10px_20px_-12px_color-mix(in_oklch,var(--primary)_80%,transparent)]">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </Link>
  );
}
