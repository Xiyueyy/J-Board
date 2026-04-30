"use client";

import Link from "next/link";
import type { Dispatch, SetStateAction } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PlanFormValue, StreamingServiceOption } from "./plan-form-types";

type FieldId = (name: string) => string;

interface StreamingConfigSectionProps {
  fieldId: FieldId;
  plan?: PlanFormValue;
  services: StreamingServiceOption[];
  streamingServiceId: string;
  setStreamingServiceId: Dispatch<SetStateAction<string>>;
  hasStreamingServices: boolean;
}

export function StreamingConfigSection({
  fieldId,
  plan,
  services,
  streamingServiceId,
  setStreamingServiceId,
  hasStreamingServices,
}: StreamingConfigSectionProps) {
  return (
    <>
      <div>
        <Label htmlFor={fieldId("streamingServiceId")}>绑定流媒体服务</Label>
        <Select
          value={streamingServiceId}
          onValueChange={(value) => setStreamingServiceId(value ?? "")}
          disabled={!hasStreamingServices}
        >
          <SelectTrigger id={fieldId("streamingServiceId")}>
            <SelectValue
              placeholder={
                hasStreamingServices ? "选择流媒体服务" : "请先去添加流媒体服务"
              }
            >
              {(value) => {
                const match = services.find((service) => service.id === value);
                return match ? `${match.name} (${match.usedSlots}/${match.maxSlots})` : "选择流媒体服务";
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {services.map((service) => (
              <SelectItem key={service.id} value={service.id}>
                {service.name} ({service.usedSlots}/{service.maxSlots})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!hasStreamingServices && (
          <p className="mt-2 text-xs text-destructive">
            还没有可用流媒体服务，请先到
            <Link href="/admin/services" className="mx-1 font-medium text-primary hover:text-primary/80">
              流媒体服务管理
            </Link>
            页面添加。
          </p>
        )}
      </div>

      <div>
        <Label htmlFor={fieldId("price")}>价格（¥）</Label>
        <Input
          id={fieldId("price")}
          name="price"
          type="number"
          step="0.01"
          min={0}
          defaultValue={plan?.price ?? ""}
          required
        />
      </div>
    </>
  );
}
