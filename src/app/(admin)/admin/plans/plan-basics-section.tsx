"use client";

import type { Dispatch, SetStateAction } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  InboundOption,
  PlanFormValue,
  PlanType,
  StreamingServiceOption,
} from "./plan-form-types";

type FieldId = (name: string) => string;

interface PlanBasicsFieldsProps {
  fieldId: FieldId;
  isEdit: boolean;
  type: PlanType;
  setType: Dispatch<SetStateAction<PlanType>>;
  plan?: PlanFormValue;
  services: StreamingServiceOption[];
  streamingServiceId: string;
  setStreamingServiceId: Dispatch<SetStateAction<string>>;
  hasStreamingServices: boolean;
  setInbounds: Dispatch<SetStateAction<InboundOption[]>>;
  setSelectedInboundIds: Dispatch<SetStateAction<string[]>>;
  setAllowTrafficTopup: Dispatch<SetStateAction<boolean>>;
}

export function PlanBasicsFields({
  fieldId,
  isEdit,
  type,
  setType,
  plan,
  services,
  streamingServiceId,
  setStreamingServiceId,
  hasStreamingServices,
  setInbounds,
  setSelectedInboundIds,
  setAllowTrafficTopup,
}: PlanBasicsFieldsProps) {
  return (
    <>
      <div>
        <Label htmlFor={fieldId("type")}>套餐类型</Label>
        {isEdit ? (
          <div id={fieldId("type")} className="premium-input flex h-11 items-center px-3 text-sm font-medium">
            {type === "PROXY" ? "代理节点套餐" : "流媒体套餐"}
          </div>
        ) : (
          <Select
            value={type}
            onValueChange={(value) => {
              const nextType = value as PlanType;
              setType(nextType);
              if (nextType !== "PROXY") {
                setInbounds([]);
                setSelectedInboundIds([]);
                setAllowTrafficTopup(false);
                if (!streamingServiceId && hasStreamingServices) {
                  setStreamingServiceId(services[0].id);
                }
              }
            }}
          >
            <SelectTrigger id={fieldId("type")}>
              <SelectValue placeholder="选择类型">
                {(value) => value === "PROXY" ? "代理节点套餐" : "流媒体套餐"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PROXY">代理节点套餐</SelectItem>
              <SelectItem value="STREAMING">流媒体套餐</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor={fieldId("name")}>套餐名称</Label>
          <Input id={fieldId("name")} name="name" defaultValue={plan?.name ?? ""} required />
        </div>
        <div>
          <Label htmlFor={fieldId("durationDays")}>有效期（天）</Label>
          <Input
            id={fieldId("durationDays")}
            name="durationDays"
            type="number"
            defaultValue={plan?.durationDays ?? 30}
            required
          />
        </div>
        <div>
          <Label htmlFor={fieldId("sortOrder")}>排序</Label>
          <Input
            id={fieldId("sortOrder")}
            name="sortOrder"
            type="number"
            defaultValue={plan?.sortOrder ?? 100}
            required
          />
        </div>
      </div>

      <div>
        <Label htmlFor={fieldId("description")}>用户说明</Label>
        <Textarea
          id={fieldId("description")}
          name="description"
          rows={2}
          defaultValue={plan?.description ?? ""}
          placeholder="适合的使用场景、交付方式与体验边界"
        />
      </div>
    </>
  );
}

export function PlanLimitsFields({
  fieldId,
  plan,
}: {
  fieldId: FieldId;
  plan?: PlanFormValue;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <Label htmlFor={fieldId("totalLimit")}>总库存</Label>
        <Input
          id={fieldId("totalLimit")}
          name="totalLimit"
          type="number"
          min={1}
          defaultValue={plan?.totalLimit ?? ""}
          placeholder="留空=不限量"
        />
      </div>
      <div>
        <Label htmlFor={fieldId("perUserLimit")}>每用户限购</Label>
        <Input
          id={fieldId("perUserLimit")}
          name="perUserLimit"
          type="number"
          min={1}
          defaultValue={plan?.perUserLimit ?? ""}
          placeholder="留空=不限购"
        />
      </div>
    </div>
  );
}

/** @deprecated Use PlanBasicsFields + PlanLimitsFields instead */
export const PlanBasicsSection = PlanBasicsFields;
