import type { ReactNode } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Server, Users, Waypoints } from "lucide-react";
import Link from "next/link";
import { batchTestNodeConnections } from "@/actions/admin/nodes";
import { BatchActionBar, BatchActionButton } from "@/components/admin/batch-action-bar";
import { EmptyState } from "@/components/shared/page-shell";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatBytes } from "@/lib/utils";
import { InboundDeleteButton } from "../inbound-delete-button";
import { InboundDisplayNameForm } from "../inbound-display-name-form";
import { NodeActions } from "../node-actions";
import { NodeForm } from "../node-form";
import type { NodeServerRow } from "../nodes-data";

const NODE_BATCH_FORM_ID = "node-batch-form";

function formatSpeed(bytes: bigint | number) {
  return `${formatBytes(bytes)}/s`;
}

function MetricItem({ icon, label, value, muted = false }: { icon: ReactNode; label: string; value: string; muted?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className={cn("mt-2 text-lg font-semibold tabular-nums", muted && "text-muted-foreground")}>{value}</p>
    </div>
  );
}

function NodeRealtimeStats({ node }: { node: NodeServerRow }) {
  const metric = node.systemMetric;
  const metricFresh = node.systemMetricFresh;
  const metricHint = node.systemMetricHint;

  return (
    <div className="space-y-2">
      <div className="grid gap-3 md:grid-cols-3">
        <MetricItem
          icon={<ArrowDownToLine className="size-3.5 text-sky-500" />}
          label="整机入站速度"
          value={metric ? formatSpeed(metric.inboundBps) : "未上报"}
          muted={!metric || !metricFresh}
        />
        <MetricItem
          icon={<ArrowUpFromLine className="size-3.5 text-emerald-500" />}
          label="整机出站速度"
          value={metric ? formatSpeed(metric.outboundBps) : "未上报"}
          muted={!metric || !metricFresh}
        />
        <MetricItem
          icon={<Users className="size-3.5 text-primary" />}
          label="3x-ui 在线用户"
          value={`${node.onlineUserCount} 个`}
        />
      </div>
      <p className="text-[11px] text-muted-foreground">{metricHint}</p>
    </div>
  );
}

function PanelInfoBar({ node }: { node: NodeServerRow }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
      <span className="font-medium text-foreground">3x-ui</span>
      <span>{node.panelUrl || "未配置面板"}</span>
      {node.agentToken && <span>探测 Token: 已启用</span>}
    </div>
  );
}

function NodeCard({ node, siteUrl }: { node: NodeServerRow; siteUrl: string | null }) {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 pb-2 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <input
            form={NODE_BATCH_FORM_ID}
            type="checkbox"
            name="nodeIds"
            value={node.id}
            aria-label={`选择节点 ${node.name}`}
            className="mt-3 size-5 rounded-lg border-border accent-primary shadow-sm"
          />
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/10 text-primary">
            <Server className="size-5" />
          </span>
          <div className="min-w-0">
            <CardTitle className="text-lg">
              <Link href={`/admin/nodes/${node.id}`} className="hover:underline">
                {node.name}
              </Link>
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {node.panelUrl || "未配置面板"} · {node._count.inbounds} 个入站
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={node.status === "active" ? "success" : "neutral"}>
            {node.status}
          </StatusBadge>
          <NodeForm
            node={{
              id: node.id,
              name: node.name,
              panelUrl: node.panelUrl,
              panelUsername: node.panelUsername,
            }}
            triggerLabel="编辑"
            triggerVariant="outline"
          />
          <NodeActions
            node={{ id: node.id, name: node.name, agentToken: node.agentToken }}
            siteUrl={siteUrl}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <PanelInfoBar node={node} />
        <NodeRealtimeStats node={node} />
        {node.inbounds.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {node.inbounds.map((inbound) => (
              <div
                key={inbound.id}
                className="flex min-w-72 flex-wrap items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium"
              >
                <Waypoints className="size-3.5 shrink-0 text-primary" />
                <span className="shrink-0 text-muted-foreground">{inbound.protocol} · {inbound.port}</span>
                <InboundDisplayNameForm
                  inboundId={inbound.id}
                  defaultValue={getInboundDisplayName(inbound)}
                />
                <InboundDeleteButton inboundId={inbound.id} />
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">暂无已同步入站，请在 3x-ui 创建入站后点击同步</p>
        )}
      </CardContent>
    </Card>
  );
}

export function NodeCardList({ nodes, siteUrl }: { nodes: NodeServerRow[]; siteUrl: string | null }) {
  return (
    <>
      <BatchActionBar id={NODE_BATCH_FORM_ID} action={batchTestNodeConnections}>
        <BatchActionButton>批量同步入站</BatchActionButton>
      </BatchActionBar>
      <div className="grid gap-5">
        {nodes.map((node) => (
          <NodeCard key={node.id} node={node} siteUrl={siteUrl} />
        ))}
        {nodes.length === 0 && (
          <EmptyState
            title="暂无节点"
            description="添加 3x-ui 节点后，可以同步入站并绑定到代理套餐。"
            action={<NodeForm triggerLabel="添加节点" />}
          />
        )}
      </div>
    </>
  );
}


function getInboundDisplayName(inbound: { tag: string; settings: unknown }) {
  const settings = inbound.settings;
  if (settings && typeof settings === "object" && "displayName" in settings) {
    const value = (settings as { displayName?: unknown }).displayName;
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return inbound.tag;
}
