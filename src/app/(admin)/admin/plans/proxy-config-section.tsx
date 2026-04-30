"use client";

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
import { cn } from "@/lib/utils";
import type {
  InboundOption,
  NodeOption,
  PlanFormValue,
  PlanPricingMode,
} from "./plan-form-types";

type FieldId = (name: string) => string;

export function ProxyNodeFields({
  fieldId,
  nodes,
  nodeId,
  setNodeId,
  inbounds,
  setInbounds,
  selectedInboundIds,
  setSelectedInboundIds,
  toggleInbound,
}: {
  fieldId: FieldId;
  nodes: NodeOption[];
  nodeId: string;
  setNodeId: Dispatch<SetStateAction<string>>;
  inbounds: InboundOption[];
  setInbounds: Dispatch<SetStateAction<InboundOption[]>>;
  selectedInboundIds: string[];
  setSelectedInboundIds: Dispatch<SetStateAction<string[]>>;
  toggleInbound: (inboundId: string) => void;
}) {
  return (
    <>
      <div>
        <Label htmlFor={fieldId("nodeId")}>节点</Label>
        <Select
          value={nodeId}
          onValueChange={(value) => {
            setNodeId(value ?? "");
            setInbounds([]);
            setSelectedInboundIds([]);
          }}
        >
          <SelectTrigger id={fieldId("nodeId")}>
            <SelectValue placeholder="选择节点">
              {(value) => {
                const match = nodes.find((node) => node.id === value);
                return match ? match.name : "选择节点";
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {nodes.map((node) => (
              <SelectItem key={node.id} value={node.id}>
                {node.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label id={fieldId("inboundIds-label")}>可售入站（可多选）</Label>
        <input type="hidden" name="inboundIds" value={selectedInboundIds.join(",")} />
        <div className="grid gap-2 sm:grid-cols-2" role="group" aria-labelledby={fieldId("inboundIds-label")}>
          {inbounds.map((inbound) => {
            const selected = selectedInboundIds.includes(inbound.id);
            return (
              <button
                key={inbound.id}
                type="button"
                className={cn(
                  "choice-card text-left px-3 py-2.5 text-sm",
                  selected
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "hover:bg-muted/45",
                )}
                onClick={() => toggleInbound(inbound.id)}
              >
                <p className="font-medium">
                  {inbound.protocol} · {inbound.port}
                </p>
                <p className="text-xs text-muted-foreground">{inbound.tag}</p>
              </button>
            );
          })}
        </div>
        {nodeId && inbounds.length === 0 && (
          <p className="mt-2 text-xs text-muted-foreground">该节点暂无可用入站</p>
        )}
      </div>
    </>
  );
}

export function ProxyPricingFields({
  fieldId,
  plan,
  pricingMode,
  setPricingMode,
  allowTrafficTopup,
}: {
  fieldId: FieldId;
  plan?: PlanFormValue;
  pricingMode: PlanPricingMode;
  setPricingMode: Dispatch<SetStateAction<PlanPricingMode>>;
  allowTrafficTopup: boolean;
}) {
  const pricingModeLabels: Record<string, string> = {
    TRAFFIC_SLIDER: "用户自选流量",
    FIXED_PACKAGE: "固定流量套餐",
  };

  return (
    <>
      <div>
        <Label htmlFor={fieldId("pricingMode")}>售卖方式</Label>
        <Select value={pricingMode} onValueChange={(value) => setPricingMode(value as PlanPricingMode)}>
          <SelectTrigger id={fieldId("pricingMode")}>
            <SelectValue placeholder="选择售卖方式">
              {(value) => pricingModeLabels[value] ?? value}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TRAFFIC_SLIDER">用户自选流量</SelectItem>
            <SelectItem value="FIXED_PACKAGE">固定流量套餐</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {pricingMode === "TRAFFIC_SLIDER" ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor={fieldId("pricePerGb")}>价格（¥/GB）</Label>
            <Input
              id={fieldId("pricePerGb")}
              name="pricePerGb"
              type="number"
              step="0.01"
              min={0}
              defaultValue={plan?.pricePerGb ?? ""}
              placeholder="例如 0.5，免费填 0"
            />
          </div>
          <div>
            <Label htmlFor={fieldId("minTrafficGb")}>最小 GB</Label>
            <Input
              id={fieldId("minTrafficGb")}
              name="minTrafficGb"
              type="number"
              defaultValue={plan?.minTrafficGb ?? ""}
              placeholder="例如 10"
            />
          </div>
          <div>
            <Label htmlFor={fieldId("maxTrafficGb")}>最大 GB</Label>
            <Input
              id={fieldId("maxTrafficGb")}
              name="maxTrafficGb"
              type="number"
              defaultValue={plan?.maxTrafficGb ?? ""}
              placeholder="例如 1000"
            />
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor={fieldId("fixedTrafficGb")}>固定流量（GB）</Label>
            <Input
              id={fieldId("fixedTrafficGb")}
              name="fixedTrafficGb"
              type="number"
              min={1}
              defaultValue={plan?.fixedTrafficGb ?? plan?.minTrafficGb ?? ""}
              placeholder="例如 200"
            />
          </div>
          <div>
            <Label htmlFor={fieldId("fixedPrice")}>固定价格（¥）</Label>
            <Input
              id={fieldId("fixedPrice")}
              name="fixedPrice"
              type="number"
              step="0.01"
              min={0}
              defaultValue={plan?.fixedPrice ?? ""}
              placeholder="例如 29.9，免费填 0"
            />
          </div>
        </div>
      )}

      <div>
        <Label htmlFor={fieldId("totalTrafficGb")}>总流量池（GB）</Label>
        <Input
          id={fieldId("totalTrafficGb")}
          name="totalTrafficGb"
          type="number"
          min={1}
          defaultValue={plan?.totalTrafficGb ?? ""}
          placeholder="留空=无限流量"
        />
        {allowTrafficTopup && (
          <p className="mt-1.5 text-xs text-muted-foreground">
            增流量上限按剩余总流量实时计算。
          </p>
        )}
      </div>
    </>
  );
}

/** @deprecated Use ProxyNodeFields + ProxyPricingFields instead */
export function ProxyConfigSection(props: {
  fieldId: FieldId;
  plan?: PlanFormValue;
  nodes: NodeOption[];
  nodeId: string;
  setNodeId: Dispatch<SetStateAction<string>>;
  inbounds: InboundOption[];
  setInbounds: Dispatch<SetStateAction<InboundOption[]>>;
  selectedInboundIds: string[];
  setSelectedInboundIds: Dispatch<SetStateAction<string[]>>;
  toggleInbound: (inboundId: string) => void;
  allowTrafficTopup: boolean;
  pricingMode: PlanPricingMode;
  setPricingMode: Dispatch<SetStateAction<PlanPricingMode>>;
}) {
  return (
    <>
      <ProxyNodeFields {...props} />
      <ProxyPricingFields {...props} />
    </>
  );
}
