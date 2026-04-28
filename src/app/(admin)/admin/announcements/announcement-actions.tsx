"use client";

import type {
  AnnouncementAudience,
  AnnouncementDisplayType,
} from "@prisma/client";
import { toast } from "sonner";
import {
  deleteAnnouncement,
  toggleAnnouncement,
} from "@/actions/admin/announcements";
import { Button } from "@/components/ui/button";
import { ConfirmActionButton } from "@/components/shared/confirm-action-button";
import { getErrorMessage } from "@/lib/errors";
import { AnnouncementForm } from "./announcement-form";

interface AnnouncementOptionUser {
  id: string;
  email: string;
}

interface AnnouncementActionItem {
  id: string;
  title: string;
  body: string;
  audience: AnnouncementAudience;
  displayType: AnnouncementDisplayType;
  targetUserId: string | null;
  dismissible: boolean;
  sendNotification: boolean;
  startAt: Date | string | null;
  endAt: Date | string | null;
  isActive: boolean;
}

export function AnnouncementActions({
  announcement,
  users,
}: {
  announcement: AnnouncementActionItem;
  users: AnnouncementOptionUser[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <AnnouncementForm announcement={announcement} users={users} />
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          void (async () => {
            try {
              await toggleAnnouncement(announcement.id, !announcement.isActive);
              toast.success(announcement.isActive ? "公告已停用" : "公告已启用");
            } catch (error) {
              toast.error(getErrorMessage(error, "更新状态失败"));
            }
          })();
        }}
      >
        {announcement.isActive ? "停用" : "启用"}
      </Button>
      <ConfirmActionButton
        size="sm"
        variant="destructive"
        title="删除这条公告？"
        description="公告本体和已经同步的站内通知会一起删除，此操作无法恢复。"
        confirmLabel="删除公告"
        successMessage="公告已删除"
        errorMessage="删除失败"
        onConfirm={() => deleteAnnouncement(announcement.id)}
      >
        删除
      </ConfirmActionButton>
    </div>
  );
}
