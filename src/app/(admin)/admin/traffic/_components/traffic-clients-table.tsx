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
import { ActiveStatusBadge, StatusBadge } from "@/components/shared/status-badge";
import { cn, formatBytes } from "@/lib/utils";
import type { TrafficClientRow } from "../traffic-data";

interface TrafficClientsTableProps {
  clients: TrafficClientRow[];
}

function TrafficUsageBar({ used, limit }: { used: number; limit: number | null }) {
  if (!limit) return null;

  const percent = Math.min(Math.round((used / limit) * 100), 100);
  return (
    <div className="mt-2 h-1.5 w-24 overflow-hidden rounded-full bg-muted">
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

export function TrafficClientsTable({ clients }: TrafficClientsTableProps) {
  const visibleClients = clients.filter((client) => client.subscription != null);

  return (
    <DataTableShell
      isEmpty={visibleClients.length === 0}
      emptyTitle="暂无流量数据"
      emptyDescription="客户端绑定订阅并同步流量后，会显示在这里。"
    >
      <DataTable aria-label="流量客户端列表" className="min-w-[760px]">
        <DataTableHead>
          <DataTableHeaderRow>
            <DataTableHeadCell>用户</DataTableHeadCell>
            <DataTableHeadCell>节点</DataTableHeadCell>
            <DataTableHeadCell>协议</DataTableHeadCell>
            <DataTableHeadCell>上传</DataTableHeadCell>
            <DataTableHeadCell>下载</DataTableHeadCell>
            <DataTableHeadCell>已用/总量</DataTableHeadCell>
            <DataTableHeadCell>状态</DataTableHeadCell>
          </DataTableHeaderRow>
        </DataTableHead>
        <DataTableBody>
          {visibleClients.map((client) => {
            const subscription = client.subscription!;
            const used = Number(subscription.trafficUsed);
            const limit = subscription.trafficLimit ? Number(subscription.trafficLimit) : null;

            return (
              <DataTableRow key={client.id}>
                <DataTableCell className="max-w-56 whitespace-normal break-all">
                  <p className="font-medium">{client.user.email}</p>
                  <p className="text-xs text-muted-foreground">{client.email}</p>
                </DataTableCell>
                <DataTableCell>{client.inbound.server.name}</DataTableCell>
                <DataTableCell>
                  <StatusBadge tone="neutral">{client.inbound.protocol}</StatusBadge>
                </DataTableCell>
                <DataTableCell className="tabular-nums">{formatBytes(client.trafficUp)}</DataTableCell>
                <DataTableCell className="tabular-nums">{formatBytes(client.trafficDown)}</DataTableCell>
                <DataTableCell>
                  <span className="tabular-nums">
                    {formatBytes(used)} / {limit ? formatBytes(limit) : "无限"}
                  </span>
                  <TrafficUsageBar used={used} limit={limit} />
                </DataTableCell>
                <DataTableCell>
                  <ActiveStatusBadge active={client.isEnabled} activeLabel="启用" inactiveLabel="禁用" />
                </DataTableCell>
              </DataTableRow>
            );
          })}
        </DataTableBody>
      </DataTable>
    </DataTableShell>
  );
}
