"use client";

import { Button } from "@/components/ui/button";
import { ConfirmActionButton } from "@/components/shared/confirm-action-button";
import { getErrorMessage } from "@/lib/errors";
import {
  activateSubscription,
  deleteSubscriptionPermanently,
  suspendSubscription,
} from "@/actions/admin/subscriptions";
import { toast } from "sonner";
import {
  StreamingSlotDialog,
  type StreamingServiceOption,
} from "./streaming-slot-dialog";

export function AdminSubscriptionActions({
  subscriptionId,
  status,
  type,
  streamingServices,
}: {
  subscriptionId: string;
  status: "ACTIVE" | "EXPIRED" | "CANCELLED" | "SUSPENDED";
  type: "PROXY" | "STREAMING" | "BUNDLE";
  streamingServices: StreamingServiceOption[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {type === "STREAMING" && streamingServices.length > 0 && (
        <StreamingSlotDialog
          subscriptionId={subscriptionId}
          services={streamingServices}
        />
      )}

      {status === "ACTIVE" && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            void (async () => {
              try {
                await suspendSubscription(subscriptionId);
                toast.success("订阅已暂停");
              } catch (error) {
                toast.error(getErrorMessage(error, "暂停失败"));
              }
            })();
          }}
        >
          暂停
        </Button>
      )}

      {status === "SUSPENDED" && (
        <Button
          size="sm"
          onClick={() => {
            void (async () => {
              try {
                await activateSubscription(subscriptionId);
                toast.success("订阅已恢复");
              } catch (error) {
                toast.error(getErrorMessage(error, "恢复失败"));
              }
            })();
          }}
        >
          恢复
        </Button>
      )}

      <ConfirmActionButton
        size="sm"
        variant="destructive"
        title="彻底删除这个订阅？"
        description="会同步删除远端客户端，并清理本地记录与相关订单。此操作无法恢复。"
        confirmLabel="删除订阅"
        successMessage="订阅已删除"
        errorMessage="删除失败"
        onConfirm={() => deleteSubscriptionPermanently(subscriptionId)}
      >
        彻底删除
      </ConfirmActionButton>
    </div>
  );
}
