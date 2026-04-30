import type { ReactNode } from "react";
import { Activity, ArrowDownToLine, ArrowUpFromLine, Clock, MapPin, Server, Users, Wifi } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/page-shell";
import { cn, formatBytes } from "@/lib/utils";
import type { NodeRealtimeRow, NodeRealtimeUserRow } from "../realtime-data";

const beijingDateFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function formatSpeed(bytes: bigint | number) {
  return `${formatBytes(bytes)}/s`;
}

function formatActiveAt(date: Date) {
  return beijingDateFormatter.format(date).replaceAll("/", "-");
}

function MetricPill({
  icon,
  label,
  value,
  muted,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 px-4 py-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className={cn("mt-2 text-lg font-semibold tabular-nums", muted && "text-muted-foreground")}>{value}</p>
    </div>
  );
}

function compactList(items: string[]) {
  if (items.length === 0) return "—";
  const visible = items.slice(0, 3).join("、");
  return items.length > 3 ? `${visible} 等 ${items.length} 个` : visible;
}

function OnlineUserItem({ user }: { user: NodeRealtimeUserRow }) {
  const displayName = user.name?.trim() || user.email;

  return (
    <div className="grid gap-3 rounded-xl border border-border bg-background px-4 py-3 text-sm lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-center">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/10 text-primary">
            <Wifi className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold" title={displayName}>{displayName}</p>
            <p className="truncate text-xs text-muted-foreground" title={user.email}>{user.email}</p>
          </div>
        </div>
      </div>
      <div className="min-w-0 text-xs text-muted-foreground">
        <p className="flex items-center gap-1.5 font-medium text-foreground">
          <Users className="size-3.5" />
          在线设备 {user.onlineDeviceCount || 1} 个
        </p>
        <p className="mt-1 truncate" title={user.recentInbounds.join("、")}>入站：{compactList(user.recentInbounds)}</p>
      </div>
      <div className="min-w-0 text-xs text-muted-foreground">
        <p className="truncate" title={user.recentSourceIps.join("、")}>来源 IP：{compactList(user.recentSourceIps)}</p>
        <p className="mt-1 truncate" title={user.recentTargetHosts.join("、")}>目标：{compactList(user.recentTargetHosts)}</p>
      </div>
      <div className="flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground">
        <Clock className="size-3.5" />
        {formatActiveAt(user.lastActiveAt)}
      </div>
    </div>
  );
}

function NodeRealtimeCard({ node }: { node: NodeRealtimeRow }) {
  const metric = node.systemMetric;
  const metricMuted = !metric || !node.systemMetricFresh;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 pb-2 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary">
            <Server className="size-5" />
          </span>
          <div className="min-w-0">
            <CardTitle className="truncate text-lg" title={node.name}>{node.name}</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">{node.systemMetricHint}</p>
          </div>
        </div>
        <StatusBadge tone={node.status === "active" ? "success" : "neutral"}>{node.status}</StatusBadge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <MetricPill
            icon={<ArrowDownToLine className="size-3.5 text-sky-500" />}
            label="整机下载 / 入站"
            value={metric ? formatSpeed(metric.inboundBps) : "未上报"}
            muted={metricMuted}
          />
          <MetricPill
            icon={<ArrowUpFromLine className="size-3.5 text-emerald-500" />}
            label="整机上传 / 出站"
            value={metric ? formatSpeed(metric.outboundBps) : "未上报"}
            muted={metricMuted}
          />
          <MetricPill
            icon={<Users className="size-3.5 text-primary" />}
            label="在线用户"
            value={`${node.onlineUserCount} 个`}
          />
          <MetricPill
            icon={<MapPin className="size-3.5 text-amber-500" />}
            label="在线设备"
            value={`${node.onlineDeviceCount} 个`}
          />
        </div>

        {node.onlineUsers.length > 0 ? (
          <div className="space-y-2">
            {node.onlineUsers.map((user) => (
              <OnlineUserItem key={user.id} user={user} />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-5 text-center text-sm text-muted-foreground">
            近 2 分钟暂无在线用户。
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function NodeRealtimeBoard({ nodes }: { nodes: NodeRealtimeRow[] }) {
  if (nodes.length === 0) {
    return (
      <EmptyState
        icon={<Activity className="size-5" />}
        title="暂无节点实时数据"
        description="添加节点并运行新版 Agent 后，这里会显示整机上传下载速度和 3x-ui 在线用户。"
      />
    );
  }

  return (
    <div className="grid gap-5">
      {nodes.map((node) => (
        <NodeRealtimeCard key={node.id} node={node} />
      ))}
    </div>
  );
}
