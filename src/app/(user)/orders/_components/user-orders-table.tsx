import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { DataTableShell } from "@/components/shared/data-table-shell";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeadCell,
  DataTableHeaderRow,
  DataTableRow,
} from "@/components/shared/data-table";
import { OrderStatusBadge } from "@/components/shared/domain-badges";
import { buttonVariants } from "@/components/ui/button";
import { formatDateShort } from "@/lib/utils";
import { UserOrderActions } from "../order-actions";
import {
  formatOrderAmount,
  formatOrderTraffic,
  orderKindLabels,
} from "../orders-calculations";
import type { UserOrderRow } from "../orders-data";

interface UserOrdersTableProps {
  orders: UserOrderRow[];
}

export function UserOrdersTable({ orders }: UserOrdersTableProps) {
  return (
    <DataTableShell
      isEmpty={orders.length === 0}
      emptyTitle="还没有订单"
      emptyDescription="选好套餐并提交支付后，你可以在这里继续支付、查看状态和回看记录。"
      emptyIcon={<ShoppingBag className="size-5" />}
      emptyAction={
        <Link href="/store" className={buttonVariants()}>
          去商店选择套餐
        </Link>
      }
    >
      <DataTable aria-label="我的订单列表" className="min-w-[780px]">
        <DataTableHead>
          <DataTableHeaderRow>
            <DataTableHeadCell>套餐</DataTableHeadCell>
            <DataTableHeadCell>类型</DataTableHeadCell>
            <DataTableHeadCell>流量</DataTableHeadCell>
            <DataTableHeadCell>金额</DataTableHeadCell>
            <DataTableHeadCell>状态</DataTableHeadCell>
            <DataTableHeadCell>时间</DataTableHeadCell>
            <DataTableHeadCell className="text-right">操作</DataTableHeadCell>
          </DataTableHeaderRow>
        </DataTableHead>
        <DataTableBody>
          {orders.map((order) => (
            <DataTableRow key={order.id}>
              <DataTableCell className="font-medium text-foreground">{order.plan.name}</DataTableCell>
              <DataTableCell className="text-muted-foreground">{orderKindLabels[order.kind]}</DataTableCell>
              <DataTableCell className="text-muted-foreground">
                {formatOrderTraffic(order.trafficGb)}
              </DataTableCell>
              <DataTableCell className="tabular-nums">{formatOrderAmount(order.amount)}</DataTableCell>
              <DataTableCell>
                <OrderStatusBadge status={order.status} />
              </DataTableCell>
              <DataTableCell className="whitespace-nowrap text-muted-foreground">
                {formatDateShort(order.createdAt)}
              </DataTableCell>
              <DataTableCell>
                <div className="flex items-center justify-end gap-3">
                  {order.status === "PENDING" && (
                    <Link
                      href={`/pay/${order.id}`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      去支付
                    </Link>
                  )}
                  <UserOrderActions orderId={order.id} status={order.status} />
                </div>
              </DataTableCell>
            </DataTableRow>
          ))}
        </DataTableBody>
      </DataTable>
    </DataTableShell>
  );
}
