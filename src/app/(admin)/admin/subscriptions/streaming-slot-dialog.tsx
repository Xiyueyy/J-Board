"use client";

import { useState } from "react";
import { reassignStreamingSlot } from "@/actions/admin/subscriptions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "sonner";

export interface StreamingServiceOption {
  id: string;
  name: string;
  usedSlots: number;
  maxSlots: number;
}

export function StreamingSlotDialog({
  subscriptionId,
  services,
}: {
  subscriptionId: string;
  services: StreamingServiceOption[];
}) {
  const [open, setOpen] = useState(false);
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [saving, setSaving] = useState(false);

  async function handleAssign() {
    if (!serviceId) {
      toast.error("请选择目标服务");
      return;
    }

    setSaving(true);
    try {
      await reassignStreamingSlot(subscriptionId, serviceId);
      toast.success("槽位已调配");
      setOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error, "调配失败"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        调配槽位
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>手动调配流媒体槽位</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Select value={serviceId} onValueChange={(value) => setServiceId(value ?? "")}>
            <SelectTrigger>
              <SelectValue placeholder="选择目标服务">
                {(v) => {
                  const m = services.find((s) => s.id === v);
                  return m ? `${m.name} · ${m.usedSlots}/${m.maxSlots}` : "选择目标服务";
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {services.map((service) => (
                <SelectItem key={service.id} value={service.id}>
                  {service.name} · {service.usedSlots}/{service.maxSlots}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button className="w-full" onClick={() => void handleAssign()} disabled={saving}>
            {saving ? "处理中..." : "确认调配"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
