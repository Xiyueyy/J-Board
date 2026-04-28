"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, CheckCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/lib/errors";
import { fetchJson } from "@/lib/fetch-json";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  markEveryNotificationAsRead,
  markNotificationAsRead,
  removeNotification,
  removeReadNotifications,
} from "@/actions/user/notifications";

interface Notification {
  id: string;
  title: string;
  body: string;
  level: string;
  isRead: boolean;
  link: string | null;
  createdAt: string;
}

interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
  readCount: number;
}

export function NotificationPopover({
  unreadCount: initialUnread,
  className,
}: {
  unreadCount?: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<NotificationsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const hasUnread = (data?.unreadCount ?? initialUnread ?? 0) > 0;
  const displayCount = data?.unreadCount ?? initialUnread ?? 0;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchJson<NotificationsResponse>("/api/notifications");
      setData(res);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  function handleOpen() {
    setOpen(true);
    void load();
  }

  async function handleMarkRead(id: string) {
    try {
      await markNotificationAsRead(id);
      void load();
      router.refresh();
    } catch (e) {
      toast.error(getErrorMessage(e, "操作失败"));
    }
  }

  async function handleDelete(id: string) {
    try {
      await removeNotification(id);
      void load();
      router.refresh();
    } catch (e) {
      toast.error(getErrorMessage(e, "删除失败"));
    }
  }

  async function handleMarkAllRead() {
    try {
      await markEveryNotificationAsRead();
      void load();
      router.refresh();
    } catch (e) {
      toast.error(getErrorMessage(e, "操作失败"));
    }
  }

  async function handleClearRead() {
    try {
      await removeReadNotifications();
      void load();
      router.refresh();
    } catch (e) {
      toast.error(getErrorMessage(e, "操作失败"));
    }
  }

  const notifications = data?.notifications ?? [];

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        aria-label={hasUnread ? `${displayCount} 条未读消息` : "消息中心"}
        className={cn(
          "relative inline-flex items-center justify-center rounded-xl transition-colors",
          hasUnread
            ? "text-sidebar-primary"
            : "text-sidebar-foreground/50 hover:text-sidebar-foreground/80",
          className,
        )}
      >
        <Bell className={cn("size-4", hasUnread && "animate-pulse")} />
        {hasUnread && (
          <span className="absolute -right-1.5 -top-1.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[0.6rem] font-bold leading-none text-primary-foreground">
            {displayCount > 99 ? "99+" : displayCount}
          </span>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[70vh] overflow-hidden p-0 sm:max-w-md" showCloseButton={false}>
          <div className="flex max-h-[70vh] flex-col overflow-hidden">
            <DialogHeader className="border-b border-border/50 px-4 pb-3 pt-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <DialogTitle className="text-base">消息中心</DialogTitle>
                <div className="flex flex-wrap items-center gap-1.5 pr-0 sm:justify-end">
                  {(data?.unreadCount ?? 0) > 0 && (
                    <Button size="sm" variant="outline" className="h-8 px-2.5 text-xs" onClick={handleMarkAllRead}>
                      <CheckCheck className="mr-1 size-3" /> 全部已读
                    </Button>
                  )}
                  {(data?.readCount ?? 0) > 0 && (
                    <Button size="sm" variant="ghost" className="h-8 px-2.5 text-xs" onClick={handleClearRead}>
                      <Trash2 className="mr-1 size-3" /> 清空已读
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="h-8 px-2.5 text-xs" onClick={() => setOpen(false)}>
                    关闭
                  </Button>
                </div>
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">加载中...</p>
            ) : notifications.length === 0 ? (
              <div className="py-10 text-center">
                <Bell className="mx-auto size-5 text-muted-foreground/40" />
                <p className="mt-2 text-sm text-muted-foreground">暂无消息</p>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={cn(
                      "px-4 py-3 transition-colors",
                      !n.isRead && "bg-primary/[0.03]",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {!n.isRead && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
                          <p className={cn("text-sm truncate", !n.isRead && "font-medium")}>{n.title}</p>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{n.body}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground/60">
                          {new Date(n.createdAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-0.5">
                        {!n.isRead && (
                          <button
                            type="button"
                            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                            onClick={() => handleMarkRead(n.id)}
                            title="标记已读"
                          >
                            <Check className="size-3" />
                          </button>
                        )}
                        <button
                          type="button"
                          className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => handleDelete(n.id)}
                          title="删除"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
