import { DataTableShell } from "@/components/admin/data-table-shell";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeadCell,
  DataTableHeaderRow,
  DataTableRow,
} from "@/components/shared/data-table";
import {
  announcementAudienceLabels,
  announcementDisplayTypeLabels,
  getAnnouncementAudienceTone,
} from "@/components/shared/domain-badges";
import { StatusBadge, ActiveStatusBadge } from "@/components/shared/status-badge";
import { formatDate } from "@/lib/utils";
import { AnnouncementActions } from "../announcement-actions";
import type { AnnouncementOptionUser, AnnouncementRow } from "../announcements-data";

interface AnnouncementsTableProps {
  announcements: AnnouncementRow[];
  users: AnnouncementOptionUser[];
}

function formatWindow(startAt: Date | null, endAt: Date | null) {
  return `${startAt ? formatDate(startAt) : "立即开始"} ~ ${endAt ? formatDate(endAt) : "长期有效"}`;
}

export function AnnouncementsTable({ announcements, users }: AnnouncementsTableProps) {
  return (
    <DataTableShell
      isEmpty={announcements.length === 0}
      emptyTitle="暂无公告或消息"
      emptyDescription="发布公告后，会显示展示范围、时间窗口和启用状态。"
    >
      <DataTable aria-label="公告列表" className="min-w-[1040px]">
        <DataTableHead>
          <DataTableHeaderRow>
            <DataTableHeadCell>标题</DataTableHeadCell>
            <DataTableHeadCell>范围</DataTableHeadCell>
            <DataTableHeadCell>展示</DataTableHeadCell>
            <DataTableHeadCell>时间窗口</DataTableHeadCell>
            <DataTableHeadCell>通知</DataTableHeadCell>
            <DataTableHeadCell>创建人</DataTableHeadCell>
            <DataTableHeadCell>状态</DataTableHeadCell>
            <DataTableHeadCell className="text-right">操作</DataTableHeadCell>
          </DataTableHeaderRow>
        </DataTableHead>
        <DataTableBody>
          {announcements.map((announcement) => (
            <DataTableRow key={announcement.id}>
              <DataTableCell className="max-w-sm">
                <p className="font-medium">{announcement.title}</p>
                <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-muted-foreground">
                  {announcement.body}
                </p>
              </DataTableCell>
              <DataTableCell>
                <div className="space-y-1">
                  <StatusBadge tone={getAnnouncementAudienceTone(announcement.audience)}>
                    {announcementAudienceLabels[announcement.audience]}
                  </StatusBadge>
                  {announcement.targetUser?.email && (
                    <p className="text-xs text-muted-foreground">{announcement.targetUser.email}</p>
                  )}
                </div>
              </DataTableCell>
              <DataTableCell>
                <p>{announcementDisplayTypeLabels[announcement.displayType]}</p>
                <p className="text-xs text-muted-foreground">
                  {announcement.dismissible ? "可关闭" : "常驻"}
                </p>
              </DataTableCell>
              <DataTableCell className="max-w-52 text-xs leading-5 text-muted-foreground">
                {formatWindow(announcement.startAt, announcement.endAt)}
              </DataTableCell>
              <DataTableCell>
                <StatusBadge tone={announcement.sendNotification ? "info" : "neutral"}>
                  {announcement.sendNotification ? "同步" : "不同步"}
                </StatusBadge>
              </DataTableCell>
              <DataTableCell className="max-w-56 whitespace-normal break-all">{announcement.createdBy?.email ?? "系统"}</DataTableCell>
              <DataTableCell>
                <ActiveStatusBadge active={announcement.isActive} activeLabel="启用" inactiveLabel="停用" />
              </DataTableCell>
              <DataTableCell>
                <div className="flex justify-end">
                  <AnnouncementActions announcement={announcement} users={users} />
                </div>
              </DataTableCell>
            </DataTableRow>
          ))}
        </DataTableBody>
      </DataTable>
    </DataTableShell>
  );
}
