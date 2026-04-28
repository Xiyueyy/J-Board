"use client";

import type { StreamingService } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { ConfirmActionButton } from "@/components/shared/confirm-action-button";
import { getErrorMessage } from "@/lib/errors";
import { deleteService, toggleServiceStatus } from "@/actions/admin/services";
import { toast } from "sonner";
import { ServiceForm } from "./service-form";

export function ServiceActions({ service }: { service: StreamingService }) {
  return (
    <div className="flex items-center gap-2">
      <ServiceForm service={service} triggerLabel="编辑" triggerVariant="outline" />
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          void (async () => {
            try {
              await toggleServiceStatus(service.id, !service.isActive);
              toast.success(service.isActive ? "服务已停用" : "服务已启用");
            } catch (error) {
              toast.error(getErrorMessage(error, "更新状态失败"));
            }
          })();
        }}
      >
        {service.isActive ? "停用" : "启用"}
      </Button>
      <ConfirmActionButton
        size="sm"
        variant="destructive"
        title="删除这个服务？"
        description="删除后无法恢复。请确认没有正在使用这个服务的共享名额。"
        confirmLabel="删除服务"
        successMessage="服务已删除"
        errorMessage="删除失败"
        onConfirm={() => deleteService(service.id)}
      >
        删除
      </ConfirmActionButton>
    </div>
  );
}
