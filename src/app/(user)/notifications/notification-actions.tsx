"use client";

import { ConfirmActionButton } from "@/components/shared/confirm-action-button";
import { Button } from "@/components/ui/button";
import {
  markEveryNotificationAsRead,
  markNotificationAsRead,
  removeNotification,
  removeReadNotifications,
} from "@/actions/user/notifications";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "sonner";

export function NotificationActions({
  notificationId,
  isRead,
}: {
  notificationId: string;
  isRead: boolean;
}) {
  return (
    <div className="flex shrink-0 flex-wrap gap-2 md:justify-end">
      {!isRead && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            void (async () => {
              try {
                await markNotificationAsRead(notificationId);
                toast.success("已标记为已读");
              } catch (error) {
                toast.error(getErrorMessage(error, "操作失败"));
              }
            })();
          }}
        >
          标记已读
        </Button>
      )}

      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          void (async () => {
            try {
              await removeNotification(notificationId);
              toast.success("通知已删除");
            } catch (error) {
              toast.error(getErrorMessage(error, "删除失败"));
            }
          })();
        }}
      >
        删除
      </Button>
    </div>
  );
}

export function NotificationBulkAction({
  unreadCount,
  readCount,
}: {
  unreadCount: number;
  readCount: number;
}) {
  return (
    <div className="flex flex-wrap gap-2 sm:justify-end">
      {unreadCount > 0 && (
        <Button
          variant="outline"
          onClick={() => {
            void (async () => {
              try {
                await markEveryNotificationAsRead();
                toast.success("全部消息已标记为已读");
              } catch (error) {
                toast.error(getErrorMessage(error, "操作失败"));
              }
            })();
          }}
        >
          全部标记已读
        </Button>
      )}

      {readCount > 0 && (
        <ConfirmActionButton
          variant="ghost"
          title="清空已读消息？"
          description="已读消息会从列表中移除，未读消息会继续保留。"
          confirmLabel="清空已读"
          successMessage="已读消息已清空"
          errorMessage="操作失败"
          onConfirm={removeReadNotifications}
        >
          清空已读
        </ConfirmActionButton>
      )}
    </div>
  );
}
