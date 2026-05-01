import type { ReactNode } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Activity, Circle, Globe, MapPin, Users, Wifi } from "lucide-react";
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

function CompactList({ items, icon, max = 3 }: { items: string[]; icon?: ReactNode; max?: number }) {
  if (items.length === 0) return <span className="text-muted-foreground">—</span>;
  const visible = items.slice(0, max);
  const extra = items.length - visible.length;

  return (
    <div className="space-y-1">
      {visible.map((item) => (
        <p key={item} className="flex items-center gap-1.5 break-all text-xs tabular-nums" title={item}>
          {icon}
          <span>{item}</span>
        </p>
      ))}
      {extra > 0 && <p className="text-[11px] text-muted-foreground">+{extra} 个</p>}
    </div>
  );
}

function UsageBar({ used, limit, className }: { used: bigint; limit: bigint | null; className?: string }) {
  if (!limit || limit <= BigInt(0)) return null;
  const percent = Math.min(100, Number((used * BigInt(10000)) / limit) / 100);
  return (
    <div className={cn("mt-2 h-1.5 w-48 overflow-hidden rounded-full bg-muted", className)}>
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

function MobileMetric({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <div className="mt-1 min-w-0 text-sm font-medium tabular-nums text-foreground">{children}</div>
    </div>
  );
}

function MobileDetail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl bg-muted/20 px-3 py-2">
      <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">{label}</p>
      <div className="min-w-0 text-sm">{children}</div>
    </div>
  );
}

function UserIdentity({ user, compact = false }: { user: OnlineUserRow; compact?: boolean }) {
  return (
    <div className={cn("flex min-w-0 items-start gap-3", compact && "gap-2.5")}>
      <span
        className={cn(
          "mt-0.5 flex shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary",
          compact ? "size-8" : "size-9",
        )}
      >
        <Wifi className={compact ? "size-3.5" : "size-4"} />
      </span>
      <div className="min-w-0">
        <p className="truncate font-semibold" title={user.name || user.email}>
          {user.name || user.email}
        </p>
        <p className="break-all text-xs text-muted-foreground">{user.email}</p>
        {!compact && <p className="mt-1 text-[11px] text-muted-foreground">{user.activeSubscriptionCount} 个活跃订阅</p>}
      </div>
    </div>
  );
}

function ActiveNodeConnections({ count }: { count: number }) {
  if (count <= 0) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5" title="近 2 分钟内该用户触达的不同节点数，同一用户同一节点只算 1 次">
      <Users className="size-3.5 text-muted-foreground" />
      {count} 个
    </span>
  );
}

function LastNode({ user }: { user: OnlineUserRow }) {
  if (!user.lastNodeName) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="min-w-0 space-y-1">
      <p className="break-words font-medium">{user.lastNodeName}</p>
      {user.lastInboundName && <p className="break-words text-xs text-muted-foreground">{user.lastInboundName}</p>}
    </div>
  );
}

function LastActive({ date }: { date: Date | null }) {
  return (
    <div className="space-y-1">
      <p className="font-medium">{formatAgo(date)}</p>
      {date && <p className="text-xs text-muted-foreground">{formatBeijingDate(date)}</p>}
    </div>
  );
}

function TotalUsage({ user, compact = false }: { user: OnlineUserRow; compact?: boolean }) {
  return (
    <div className="space-y-1 tabular-nums">
      <p>
        {formatBytes(user.totalUsedBytes)} / {user.totalLimitBytes ? formatBytes(user.totalLimitBytes) : "无限"}
      </p>
      <UsageBar used={user.totalUsedBytes} limit={user.totalLimitBytes} className={compact ? "w-full" : undefined} />
    </div>
  );
}

function MobileOnlineUserCard({ user }: { user: OnlineUserRow }) {
  return (
    <article className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm shadow-black/[0.03]">
      <div className="flex items-start justify-between gap-3">
        <UserIdentity user={user} compact />
        <div className="shrink-0">
          <OnlineStateBadge state={user.onlineState} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <StatusBadge tone="neutral">订阅 {user.activeSubscriptionCount}</StatusBadge>
        <StatusBadge tone={user.activeNodeConnectionCount > 0 ? "warning" : "neutral"}>
          活跃节点 {user.activeNodeConnectionCount}
        </StatusBadge>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <MobileMetric label="最后活跃">
          <LastActive date={user.lastActiveAt} />
        </MobileMetric>
        <MobileMetric label="到期时间">
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <Circle className="size-2 fill-current text-muted-foreground" />
            {formatExpiry(user.expiresAt)}
          </span>
        </MobileMetric>
        <MobileMetric label="本月用量">
          <span className="inline-flex items-center gap-1.5">
            <Activity className="size-3.5 text-muted-foreground" />
            {formatBytes(user.monthlyUsageBytes)}
          </span>
        </MobileMetric>
        <MobileMetric label="总流量">
          <TotalUsage user={user} compact />
        </MobileMetric>
      </div>

      <div className="mt-3 space-y-2 border-t border-border/50 pt-3">
        <MobileDetail label="最后连接节点">
          <LastNode user={user} />
        </MobileDetail>
        <MobileDetail label="来源 IP">
          <CompactList items={user.recentSourceIps} icon={<MapPin className="size-3 shrink-0 text-muted-foreground" />} max={4} />
        </MobileDetail>
        <MobileDetail label="目标网站">
          <CompactList items={user.recentTargetHosts} icon={<Globe className="size-3 shrink-0 text-muted-foreground" />} max={4} />
        </MobileDetail>
      </div>
    </article>
  );
}

function MobileOnlineUsersList({ users }: OnlineUsersTableProps) {
  if (users.length === 0) {
    return (
      <DataTableShell
        className="md:hidden"
        isEmpty
        emptyTitle="暂无在线用户数据"
        emptyDescription="开启 Agent access log 或等待 3x-ui 流量同步后，会显示最近连接节点和活跃状态。"
        scrollHint=""
        showScrollShadow={false}
      >
        <div />
      </DataTableShell>
    );
  }

  return (
    <div className="space-y-3 md:hidden">
      {users.map((user) => (
        <MobileOnlineUserCard key={user.id} user={user} />
      ))}
    </div>
  );
}

function DesktopOnlineUsersTable({ users }: OnlineUsersTableProps) {
  return (
    <DataTableShell
      className="hidden md:block"
      isEmpty={users.length === 0}
      emptyTitle="暂无在线用户数据"
      emptyDescription="开启 Agent access log 或等待 3x-ui 流量同步后，会显示最近连接节点和活跃状态。"
    >
      <DataTable aria-label="在线用户列表" className="min-w-[1480px]">
        <DataTableHead>
          <DataTableHeaderRow>
            <DataTableHeadCell>用户</DataTableHeadCell>
            <DataTableHeadCell>状态</DataTableHeadCell>
            <DataTableHeadCell>活跃节点连接</DataTableHeadCell>
            <DataTableHeadCell>来源 IP</DataTableHeadCell>
            <DataTableHeadCell>目标网站</DataTableHeadCell>
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
                <UserIdentity user={user} />
              </DataTableCell>
              <DataTableCell>
                <OnlineStateBadge state={user.onlineState} />
              </DataTableCell>
              <DataTableCell className="tabular-nums">
                <ActiveNodeConnections count={user.activeNodeConnectionCount} />
              </DataTableCell>
              <DataTableCell className="max-w-44 whitespace-normal">
                <CompactList items={user.recentSourceIps} icon={<MapPin className="size-3 shrink-0 text-muted-foreground" />} />
              </DataTableCell>
              <DataTableCell className="max-w-56 whitespace-normal">
                <CompactList items={user.recentTargetHosts} icon={<Globe className="size-3 shrink-0 text-muted-foreground" />} />
              </DataTableCell>
              <DataTableCell className="max-w-56 whitespace-normal break-words">
                <LastNode user={user} />
              </DataTableCell>
              <DataTableCell>
                <LastActive date={user.lastActiveAt} />
              </DataTableCell>
              <DataTableCell className="tabular-nums">
                <span className="inline-flex items-center gap-1.5">
                  <Activity className="size-3.5 text-muted-foreground" />
                  {formatBytes(user.monthlyUsageBytes)}
                </span>
              </DataTableCell>
              <DataTableCell>
                <TotalUsage user={user} />
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

export function OnlineUsersTable({ users }: OnlineUsersTableProps) {
  return (
    <>
      <MobileOnlineUsersList users={users} />
      <DesktopOnlineUsersTable users={users} />
    </>
  );
}
