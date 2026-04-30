import type { ReactNode } from "react";
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

const desktopBatchFormId = "order-batch-form-desktop";
const mobileBatchFormId = "order-batch-form-mobile";

function formatOrderAmount(amount: { toString(): string }) {
  return `¥${Number(amount).toFixed(2)}`;
}

function formatOrderTraffic(trafficGb: number | null) {
  return trafficGb === null ? "—" : `${trafficGb} GB`;
}

function BatchToolbar({ formId }: { formId: string }) {
  return (
    <BatchActionBar
      id={formId}
      action={batchOrderOperation}
      className="rounded-none bg-transparent"
    >
      <BatchActionButton value="confirm">批量确认</BatchActionButton>
      <BatchActionButton value="cancel" destructive>
        批量取消
      </BatchActionButton>
    </BatchActionBar>
  );
}

function MobileInfoRow({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-lg bg-muted/25 px-3 py-2">
      <p className="text-[0.68rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <div className={valueClassName ?? "mt-1 text-sm font-medium text-foreground"}>{value}</div>
    </div>
  );
}

function MobileOrderCard({ order }: { order: AdminOrderRow }) {
  return (
    <article className="rounded-xl border border-border/70 bg-card/80 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <input
          form={mobileBatchFormId}
          type="checkbox"
          name="orderIds"
          value={order.id}
          aria-label={`选择订单 ${order.id}`}
          className="mt-1 size-4 shrink-0 rounded border-border accent-primary"
        />
        <div className="min-w-0 flex-1">
          <p className="break-all text-sm font-semibold leading-5">{order.user.email}</p>
          <p className="mt-1 text-xs text-muted-foreground">{order.user.name || "未设置昵称"}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <OrderStatusBadge status={order.status} />
          <OrderReviewStatusBadge status={order.reviewStatus} />
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <p className="text-[0.68rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">套餐</p>
          <p className="mt-1 break-words text-base font-semibold leading-6">{order.plan.name}</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <MobileInfoRow label="类型" value={orderKindLabels[order.kind]} />
          <MobileInfoRow
            label="金额"
            value={formatOrderAmount(order.amount)}
            valueClassName="mt-1 text-sm font-semibold tabular-nums text-primary"
          />
          <MobileInfoRow label="流量" value={formatOrderTraffic(order.trafficGb)} />
          <MobileInfoRow label="时间" value={formatDateShort(order.createdAt)} />
        </div>

        <div className="rounded-lg border border-border/60 bg-muted/15 px-3 py-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[0.68rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">支付</span>
            <span className="text-xs font-medium text-foreground">{order.paymentMethod || "—"}</span>
          </div>
          <p className="mt-2 break-all font-mono text-xs leading-5 text-muted-foreground">
            {order.tradeNo || "—"}
          </p>
        </div>

        {(order.note || order.reviewNote) && (
          <div className="space-y-1 rounded-lg border border-border/60 bg-muted/15 px-3 py-2 text-xs leading-5 text-muted-foreground">
            {order.note && <p className="whitespace-pre-wrap break-words">{order.note}</p>}
            {order.reviewNote && <p className="whitespace-pre-wrap break-words">审查备注：{order.reviewNote}</p>}
          </div>
        )}

        <div className="space-y-3 border-t border-border/50 pt-3">
          <OrderReviewActions orderId={order.id} reviewStatus={order.reviewStatus} />
          <OrderActions orderId={order.id} status={order.status} />
        </div>
      </div>
    </article>
  );
}

export function OrdersTable({ orders }: OrdersTableProps) {
  return (
    <>
      <DataTableShell
        isEmpty={orders.length === 0}
        emptyTitle="暂无订单"
        emptyDescription="用户创建订单后，支付和审查状态会出现在这里。"
        toolbar={<BatchToolbar formId={desktopBatchFormId} />}
        className="hidden md:block"
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
                    form={desktopBatchFormId}
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

      <DataTableShell
        isEmpty={orders.length === 0}
        emptyTitle="暂无订单"
        emptyDescription="用户创建订单后，支付和审查状态会出现在这里。"
        toolbar={<BatchToolbar formId={mobileBatchFormId} />}
        showScrollShadow={false}
        scrollHint=""
        className="md:hidden"
      >
        {orders.length > 0 && (
          <div className="grid min-w-0 gap-3 p-3">
            {orders.map((order) => (
              <MobileOrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </DataTableShell>
    </>
  );
}
