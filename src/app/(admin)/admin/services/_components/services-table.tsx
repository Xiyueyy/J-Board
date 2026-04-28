import { batchToggleServiceStatus } from "@/actions/admin/services";
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
import { ActiveStatusBadge, StatusBadge } from "@/components/shared/status-badge";
import { CredentialCell } from "../credential-cell";
import { ServiceActions } from "../service-actions";
import type { StreamingServiceRow } from "../services-data";

export function ServicesTable({ services }: { services: StreamingServiceRow[] }) {
  return (
    <DataTableShell
      isEmpty={services.length === 0}
      emptyTitle="暂无流媒体服务"
      emptyDescription="添加服务后，流媒体套餐才能分配共享槽位。"
      toolbar={
        <BatchActionBar
          id="service-batch-form"
          action={batchToggleServiceStatus}
          className="rounded-none bg-transparent"
        >
          <BatchActionButton name="isActive" value="true">批量启用</BatchActionButton>
          <BatchActionButton name="isActive" value="false" destructive>批量停用</BatchActionButton>
        </BatchActionBar>
      }
    >
      <DataTable aria-label="流媒体服务列表" className="min-w-[980px]">
        <DataTableHead>
          <DataTableHeaderRow>
            <DataTableHeadCell>选择</DataTableHeadCell>
            <DataTableHeadCell>名称</DataTableHeadCell>
            <DataTableHeadCell>状态</DataTableHeadCell>
            <DataTableHeadCell>凭据</DataTableHeadCell>
            <DataTableHeadCell>插槽</DataTableHeadCell>
            <DataTableHeadCell>描述</DataTableHeadCell>
            <DataTableHeadCell className="text-right">操作</DataTableHeadCell>
          </DataTableHeaderRow>
        </DataTableHead>
        <DataTableBody>
          {services.map((service) => (
            <DataTableRow key={service.id}>
              <DataTableCell>
                <input
                  form="service-batch-form"
                  type="checkbox"
                  name="serviceIds"
                  value={service.id}
                  aria-label={`选择服务 ${service.name}`}
                />
              </DataTableCell>
              <DataTableCell className="max-w-52 whitespace-normal break-words font-medium">{service.name}</DataTableCell>
              <DataTableCell>
                <ActiveStatusBadge active={service.isActive} />
              </DataTableCell>
              <DataTableCell>
                <CredentialCell serviceId={service.id} />
              </DataTableCell>
              <DataTableCell>
                <StatusBadge tone={service.usedSlots >= service.maxSlots ? "danger" : "success"}>
                  {service.usedSlots}/{service.maxSlots}
                </StatusBadge>
                <p className="mt-1 text-xs text-muted-foreground">
                  已分配 {service._count.slots} 个订阅槽位
                </p>
              </DataTableCell>
              <DataTableCell className="max-w-sm whitespace-normal break-words text-muted-foreground">
                {service.description || "—"}
              </DataTableCell>
              <DataTableCell>
                <div className="flex justify-end">
                  <ServiceActions service={service} />
                </div>
              </DataTableCell>
            </DataTableRow>
          ))}
        </DataTableBody>
      </DataTable>
    </DataTableShell>
  );
}
