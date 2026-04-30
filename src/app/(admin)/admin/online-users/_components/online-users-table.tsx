import { formatDistanceToNowStrict } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Activity, Circle, Users, Wifi } from "lucide-react";
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
import { StatusBadge, type StatusTone } from "@/components/shared/status-badge";
import { cn, formatBytes } from "@/lib/utils";
import type { OnlineUserRow } from "../online-users-data";

interface OnlineUsersTableProps {
  users: OnlineUserRow[];
}


const beijingDateFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function formatBeijingDate(date: Date | string) {
  const parts = Object.fromEntries(
    beijingDateFormatter
      .formatToParts(new Date(date))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

const stateMeta: Record<OnlineUserRow["onlineState"], { label: string; tone: StatusTone; dot: string }> = {
  ONLINE: { label: "在线", tone: "success", dot: "bg-emerald-500" },
  RECENT: { label: "刚活跃", tone: "info", dot: "bg-sky-500" },
  IDLE: { label: "离线", tone: "neutral", dot: "bg-muted-foreground" },
  INACTIVE: { label: "无订阅", tone: "warning", dot: "bg-amber-500" },
  DISABLED: { label: "停用", tone: "danger", dot: "bg-destructive" },
};

function formatAgo(date: Date | null) {
  if (!date) return "—";
  return `${formatDistanceToNowStrict(date, { locale: zhCN })}前`;
}

function formatExpiry(date: Date | null) {
  if (!date) return "—";
  if (date.getTime() <= Date.now()) return "已到期";
  return (
    <span title={formatBeijingDate(date)}>
      {formatDistanceToNowStrict(date, { locale: zhCN })}后
    </span>
  );
}

function UsageBar({ used, limit }: { used: bigint; limit: bigint | null }) {
  if (!limit || limit <= BigInt(0)) return null;
  const percent = Math.min(100, Number((used * BigInt(10000)) / limit) / 100);
  return (
    <div className="mt-2 h-1.5 w-48 overflow-hidden rounded-full bg-muted">
      <div
        className={cn(
          "h-full rounded-full",
          percent > 90 ? "bg-destructive" : percent > 70 ? "bg-amber-500" : "bg-emerald-500",
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

function OnlineStateBadge({ state }: { state: OnlineUserRow["onlineState"] }) {
  const meta = stateMeta[state];
  return (
    <StatusBadge tone={meta.tone} className="gap-1.5">
      <span className={cn("size-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </StatusBadge>
  );
}

export function OnlineUsersTable({ users }: OnlineUsersTableProps) {
  return (
    <DataTableShell
      isEmpty={users.length === 0}
      emptyTitle="暂无在线用户数据"
      emptyDescription="开启 Agent access log 或等待 3x-ui 流量同步后，会显示最近连接节点和活跃状态。"
    >
      <DataTable aria-label="在线用户列表" className="min-w-[1180px]">
        <DataTableHead>
          <DataTableHeaderRow>
            <DataTableHeadCell>用户</DataTableHeadCell>
            <DataTableHeadCell>状态</DataTableHeadCell>
            <DataTableHeadCell>在线数</DataTableHeadCell>
            <DataTableHeadCell>最后连接节点</DataTableHeadCell>
            <DataTableHeadCell>最后活跃</DataTableHeadCell>
            <DataTableHeadCell>本月用量</DataTableHeadCell>
            <DataTableHeadCell>总流量</DataTableHeadCell>
            <DataTableHeadCell>到期时间</DataTableHeadCell>
          </DataTableHeaderRow>
        </DataTableHead>
        <DataTableBody>
          {users.map((user) => (
            <DataTableRow key={user.id}>
              <DataTableCell className="max-w-64 whitespace-normal break-all">
                <div className="flex items-start gap-3">
                  <span className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary">
                    <Wifi className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold">{user.name || user.email}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{user.activeSubscriptionCount} 个活跃订阅</p>
                  </div>
                </div>
              </DataTableCell>
              <DataTableCell>
                <OnlineStateBadge state={user.onlineState} />
              </DataTableCell>
              <DataTableCell className="tabular-nums">
                {user.onlineSourceCount > 0 ? (
                  <span className="inline-flex items-center gap-1.5" title="近 2 分钟活跃数量估算">
                    <Users className="size-3.5 text-muted-foreground" />
                    {user.onlineSourceCount} 个
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </DataTableCell>
              <DataTableCell className="max-w-56 whitespace-normal break-words">
                {user.lastNodeName ? (
                  <div className="space-y-1">
                    <p className="font-medium">{user.lastNodeName}</p>
                    {user.lastInboundName && <p className="text-xs text-muted-foreground">{user.lastInboundName}</p>}
                  </div>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </DataTableCell>
              <DataTableCell>
                <div className="space-y-1">
                  <p className="font-medium">{formatAgo(user.lastActiveAt)}</p>
                  {user.lastActiveAt && <p className="text-xs text-muted-foreground">{formatBeijingDate(user.lastActiveAt)}</p>}
                </div>
              </DataTableCell>
              <DataTableCell className="tabular-nums">
                <span className="inline-flex items-center gap-1.5">
                  <Activity className="size-3.5 text-muted-foreground" />
                  {formatBytes(user.monthlyUsageBytes)}
                </span>
              </DataTableCell>
              <DataTableCell>
                <div className="space-y-1 tabular-nums">
                  <p>
                    {formatBytes(user.totalUsedBytes)} / {user.totalLimitBytes ? formatBytes(user.totalLimitBytes) : "无限"}
                  </p>
                  <UsageBar used={user.totalUsedBytes} limit={user.totalLimitBytes} />
                </div>
              </DataTableCell>
              <DataTableCell>
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                  <Circle className="size-2 fill-current text-muted-foreground" />
                  {formatExpiry(user.expiresAt)}
                </span>
              </DataTableCell>
            </DataTableRow>
          ))}
        </DataTableBody>
      </DataTable>
    </DataTableShell>
  );
}
