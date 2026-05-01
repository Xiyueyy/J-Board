import type { ReactNode } from "react";
import { Activity, ArrowDownToLine, ArrowUpFromLine, Clock, MapPin, Server, Users, Wifi } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/page-shell";
import { cn, formatBytes } from "@/lib/utils";
import type { NodeRealtimeRow, NodeRealtimeUserRow } from "../realtime-data";

const beijingDateFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
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
    <div className="min-w-0 rounded-lg border border-border bg-muted/20 px-2.5 py-2">
      <div className="flex min-w-0 items-center gap-1.5 text-[11px] leading-none text-muted-foreground">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <p className={cn("mt-1.5 truncate text-sm font-semibold tabular-nums sm:text-base", muted && "text-muted-foreground")} title={value}>{value}</p>
    </div>
  );
}

function compactList(items: string[], max = 2) {
  if (items.length === 0) return "—";
  const visible = items.slice(0, max).join("、");
  return items.length > max ? `${visible} +${items.length - max}` : visible;
}

function OnlineUserItem({ user }: { user: NodeRealtimeUserRow }) {
  const displayName = user.name?.trim() || user.email;
  const sourceTitle = user.recentSourceIps.join("、");
  const targetTitle = user.recentTargetHosts.join("、");
  const inboundTitle = user.recentInbounds.join("、");

  return (
    <div className="rounded-lg border border-border bg-background px-2.5 py-2 text-xs">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-primary/15 bg-primary/10 text-primary">
            <Wifi className="size-3.5" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold leading-5" title={displayName}>{displayName}</p>
            <p className="truncate text-[11px] leading-4 text-muted-foreground" title={user.email}>{user.email}</p>
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-primary/15 bg-primary/5 px-2 py-0.5 text-[11px] font-medium text-primary">
          {user.sourceIpCount || 1} 来源
        </span>
      </div>
      <div className="mt-2 grid gap-x-3 gap-y-1 text-[11px] leading-4 text-muted-foreground sm:grid-cols-2">
        <p className="truncate" title={inboundTitle}>入站：{compactList(user.recentInbounds)}</p>
        <p className="truncate" title={sourceTitle}>来源：{compactList(user.recentSourceIps)}</p>
        <p className="truncate sm:col-span-2" title={targetTitle}>目标：{compactList(user.recentTargetHosts, 3)}</p>
        <p className="flex items-center gap-1.5 whitespace-nowrap text-muted-foreground sm:col-span-2">
          <Clock className="size-3" />
          {formatActiveAt(user.lastActiveAt)}
        </p>
      </div>
    </div>
  );
}

function NodeRealtimeCard({ node }: { node: NodeRealtimeRow }) {
  const metric = node.systemMetric;
  const metricMuted = !metric || !node.systemMetricFresh;

  return (
    <Card size="sm" className="gap-3 py-3">
      <CardHeader className="flex flex-row items-start justify-between gap-2 px-3 pb-0 sm:px-4">
        <div className="flex min-w-0 items-start gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/10 text-primary">
            <Server className="size-4" />
          </span>
          <div className="min-w-0">
            <CardTitle className="truncate text-sm" title={node.name}>{node.name}</CardTitle>
            <p className="mt-0.5 truncate text-[11px] leading-4 text-muted-foreground" title={node.systemMetricHint}>{node.systemMetricHint}</p>
          </div>
        </div>
        <StatusBadge tone={node.status === "active" ? "success" : "neutral"} className="h-5 shrink-0 px-2 text-[11px]">
          {node.status}
        </StatusBadge>
      </CardHeader>
      <CardContent className="space-y-3 px-3 sm:px-4">
        <div className="grid grid-cols-2 gap-2">
          <MetricPill
            icon={<ArrowDownToLine className="size-3 shrink-0 text-sky-500" />}
            label="下载/入站"
            value={metric ? formatSpeed(metric.inboundBps) : "未上报"}
            muted={metricMuted}
          />
          <MetricPill
            icon={<ArrowUpFromLine className="size-3 shrink-0 text-emerald-500" />}
            label="上传/出站"
            value={metric ? formatSpeed(metric.outboundBps) : "未上报"}
            muted={metricMuted}
          />
          <MetricPill
            icon={<Users className="size-3 shrink-0 text-primary" />}
            label="在线用户"
            value={`${node.onlineUserCount} 个`}
          />
          <MetricPill
            icon={<MapPin className="size-3 shrink-0 text-amber-500" />}
            label="来源 IP"
            value={`${node.sourceIpCount} 个`}
          />
        </div>

        {node.onlineUsers.length > 0 ? (
          <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1 sm:max-h-72">
            {node.onlineUsers.map((user) => (
              <OnlineUserItem key={user.id} user={user} />
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-3 text-center text-xs text-muted-foreground">
            近 2 分钟暂无在线用户
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
        description="添加节点并运行新版 Agent 后，这里会显示整机上传下载速度、3x-ui 在线用户和来源 IP。"
      />
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {nodes.map((node) => (
        <NodeRealtimeCard key={node.id} node={node} />
      ))}
    </div>
  );
}
