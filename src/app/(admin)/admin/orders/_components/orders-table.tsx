import { batchOrderOperation } from "@/actions/admin/orders";
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
  OrderReviewStatusBadge,
  OrderStatusBadge,
  orderKindLabels,
} from "@/components/shared/domain-badges";
import { formatDateShort } from "@/lib/utils";
import { OrderActions } from "../order-actions";
import { OrderReviewActions } from "../order-review-actions";
import type { AdminOrderRow } from "../orders-data";

interface OrdersTableProps {
  orders: AdminOrderRow[];
}

function formatOrderAmount(amount: { toString(): string }) {
  return `¥${Number(amount).toFixed(2)}`;
}

function formatOrderTraffic(trafficGb: number | null) {
  return trafficGb === null ? "—" : `${trafficGb} GB`;
}

export function OrdersTable({ orders }: OrdersTableProps) {
  return (
    <DataTableShell
      isEmpty={orders.length === 0}
      emptyTitle="暂无订单"
      emptyDescription="用户创建订单后，支付和审查状态会出现在这里。"
      toolbar={
        <BatchActionBar
          id="order-batch-form"
          action={batchOrderOperation}
          className="rounded-none bg-transparent"
        >
          <BatchActionButton value="confirm">批量确认</BatchActionButton>
          <BatchActionButton value="cancel" destructive>
            批量取消
          </BatchActionButton>
        </BatchActionBar>
      }
    >
      <DataTable aria-label="订单列表" className="min-w-[1180px]">
        <DataTableHead>
          <DataTableHeaderRow>
            <DataTableHeadCell>选择</DataTableHeadCell>
            <DataTableHeadCell>用户</DataTableHeadCell>
            <DataTableHeadCell>套餐</DataTableHeadCell>
            <DataTableHeadCell>类型</DataTableHeadCell>
            <DataTableHeadCell>金额</DataTableHeadCell>
            <DataTableHeadCell>流量</DataTableHeadCell>
            <DataTableHeadCell>支付</DataTableHeadCell>
            <DataTableHeadCell>状态</DataTableHeadCell>
            <DataTableHeadCell>审查</DataTableHeadCell>
            <DataTableHeadCell>备注</DataTableHeadCell>
            <DataTableHeadCell>时间</DataTableHeadCell>
            <DataTableHeadCell className="text-right">操作</DataTableHeadCell>
          </DataTableHeaderRow>
        </DataTableHead>
        <DataTableBody>
          {orders.map((order) => (
            <DataTableRow key={order.id}>
              <DataTableCell>
                <input
                  form="order-batch-form"
                  type="checkbox"
                  name="orderIds"
                  value={order.id}
                  aria-label={`选择订单 ${order.id}`}
                />
              </DataTableCell>
              <DataTableCell className="max-w-56 whitespace-normal break-all">
                <p className="font-medium">{order.user.email}</p>
                <p className="text-xs text-muted-foreground">{order.user.name || "未设置昵称"}</p>
              </DataTableCell>
              <DataTableCell className="max-w-52 whitespace-normal break-words font-medium">{order.plan.name}</DataTableCell>
              <DataTableCell className="text-muted-foreground">{orderKindLabels[order.kind]}</DataTableCell>
              <DataTableCell className="tabular-nums">{formatOrderAmount(order.amount)}</DataTableCell>
              <DataTableCell className="text-muted-foreground">{formatOrderTraffic(order.trafficGb)}</DataTableCell>
              <DataTableCell>
                <div className="space-y-1">
                  <p>{order.paymentMethod || "—"}</p>
                  <p className="max-w-48 break-all text-xs text-muted-foreground">
                    {order.tradeNo || "—"}
                  </p>
                </div>
              </DataTableCell>
              <DataTableCell>
                <OrderStatusBadge status={order.status} />
              </DataTableCell>
              <DataTableCell>
                <div className="space-y-2">
                  <OrderReviewStatusBadge status={order.reviewStatus} />
                  <OrderReviewActions orderId={order.id} reviewStatus={order.reviewStatus} />
                </div>
              </DataTableCell>
              <DataTableCell className="max-w-64 text-xs text-muted-foreground">
                <div className="space-y-1 whitespace-pre-wrap break-words">
                  <p>{order.note || "—"}</p>
                  {order.reviewNote && <p>审查备注：{order.reviewNote}</p>}
                </div>
              </DataTableCell>
              <DataTableCell className="whitespace-nowrap text-muted-foreground">
                {formatDateShort(order.createdAt)}
              </DataTableCell>
              <DataTableCell>
                <div className="flex justify-end">
                  <OrderActions orderId={order.id} status={order.status} />
                </div>
              </DataTableCell>
            </DataTableRow>
          ))}
        </DataTableBody>
      </DataTable>
    </DataTableShell>
  );
}
