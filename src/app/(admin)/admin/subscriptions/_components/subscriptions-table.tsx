import Link from "next/link";
import { batchSubscriptionOperation } from "@/actions/admin/subscriptions";
import { BatchActionBar, BatchActionButton } from "@/components/admin/batch-action-bar";
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
  SubscriptionStatusBadge,
  SubscriptionTypeBadge,
} from "@/components/shared/domain-badges";
import { formatBytes, formatDateShort } from "@/lib/utils";
import { AdminSubscriptionActions } from "../subscription-actions";
import type { StreamingServiceOption } from "../streaming-slot-dialog";
import type { AdminSubscriptionRow } from "../subscriptions-data";

interface SubscriptionsTableProps {
  subscriptions: AdminSubscriptionRow[];
  streamingServices: StreamingServiceOption[];
}

function SubscriptionResource({ subscription }: { subscription: AdminSubscriptionRow }) {
  if (subscription.plan.type === "PROXY") {
    return (
      <div className="space-y-1">
        <p>{subscription.nodeClient?.inbound.server.name ?? "未分配节点"}</p>
        <p className="text-xs text-muted-foreground">
          {subscription.nodeClient
            ? `${subscription.nodeClient.inbound.protocol} · ${subscription.nodeClient.inbound.tag}`
            : "暂无客户端"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <p>{subscription.streamingSlot?.service.name ?? "未分配服务"}</p>
      <p className="text-xs text-muted-foreground">
        {subscription.streamingSlot ? "已占用槽位" : "暂无槽位"}
      </p>
    </div>
  );
}

function SubscriptionTraffic({ subscription }: { subscription: AdminSubscriptionRow }) {
  if (subscription.plan.type !== "PROXY") return <span className="text-muted-foreground">—</span>;

  const limit = subscription.trafficLimit ? formatBytes(subscription.trafficLimit) : "无限";
  const used = formatBytes(subscription.trafficUsed);

  return <span>{used} / {limit}</span>;
}

export function SubscriptionsTable({
  subscriptions,
  streamingServices,
}: SubscriptionsTableProps) {
  return (
    <DataTableShell
      isEmpty={subscriptions.length === 0}
      emptyTitle="暂无订阅记录"
      emptyDescription="用户完成购买并开通后，订阅会出现在这里。"
      toolbar={
        <BatchActionBar
          id="subscription-batch-form"
          action={batchSubscriptionOperation}
          className="rounded-none bg-transparent"
        >
          <BatchActionButton value="suspend">批量封停</BatchActionButton>
          <BatchActionButton value="activate">批量恢复</BatchActionButton>
          <BatchActionButton value="delete" destructive>
            批量彻底删除
          </BatchActionButton>
        </BatchActionBar>
      }
    >
      <DataTable aria-label="订阅列表" className="min-w-[1080px]">
        <DataTableHead>
          <DataTableHeaderRow>
            <DataTableHeadCell>选择</DataTableHeadCell>
            <DataTableHeadCell>用户</DataTableHeadCell>
            <DataTableHeadCell>套餐</DataTableHeadCell>
            <DataTableHeadCell>类型</DataTableHeadCell>
            <DataTableHeadCell>资源</DataTableHeadCell>
            <DataTableHeadCell>流量</DataTableHeadCell>
            <DataTableHeadCell>有效期</DataTableHeadCell>
            <DataTableHeadCell>状态</DataTableHeadCell>
            <DataTableHeadCell className="text-right">操作</DataTableHeadCell>
          </DataTableHeaderRow>
        </DataTableHead>
        <DataTableBody>
          {subscriptions.map((subscription) => (
            <DataTableRow key={subscription.id}>
              <DataTableCell>
                <input
                  form="subscription-batch-form"
                  type="checkbox"
                  name="subscriptionIds"
                  value={subscription.id}
                  aria-label={`选择订阅 ${subscription.id}`}
                />
              </DataTableCell>
              <DataTableCell className="max-w-56 whitespace-normal break-all">
                <p className="font-medium">{subscription.user.email}</p>
                <p className="text-xs text-muted-foreground">
                  {subscription.user.name || "未设置昵称"}
                </p>
              </DataTableCell>
              <DataTableCell className="max-w-52 whitespace-normal break-words">
                <Link
                  href={`/admin/subscriptions/${subscription.id}`}
                  className="font-medium hover:underline"
                >
                  {subscription.plan.name}
                </Link>
              </DataTableCell>
              <DataTableCell>
                <SubscriptionTypeBadge type={subscription.plan.type} />
              </DataTableCell>
              <DataTableCell>
                <SubscriptionResource subscription={subscription} />
              </DataTableCell>
              <DataTableCell>
                <SubscriptionTraffic subscription={subscription} />
              </DataTableCell>
              <DataTableCell>
                <p>{formatDateShort(subscription.startDate)}</p>
                <p className="text-xs text-muted-foreground">
                  到 {formatDateShort(subscription.endDate)}
                </p>
              </DataTableCell>
              <DataTableCell>
                <SubscriptionStatusBadge status={subscription.status} />
              </DataTableCell>
              <DataTableCell>
                <div className="flex justify-end">
                  <AdminSubscriptionActions
                    subscriptionId={subscription.id}
                    status={subscription.status}
                    type={subscription.plan.type}
                    streamingServices={streamingServices}
                  />
                </div>
              </DataTableCell>
            </DataTableRow>
          ))}
        </DataTableBody>
      </DataTable>
    </DataTableShell>
  );
}
