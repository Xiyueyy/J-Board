"use client";

import type { Dispatch, SetStateAction } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  BundlePlanCandidate,
  BundlePlanFormItem,
  PlanFormValue,
} from "./plan-form-types";

type FieldId = (name: string) => string;

interface Props {
  fieldId: FieldId;
  plan?: PlanFormValue;
  candidates: BundlePlanCandidate[];
  bundleItems: BundlePlanFormItem[];
  setBundleItems: Dispatch<SetStateAction<BundlePlanFormItem[]>>;
}

function defaultItem(candidate: BundlePlanCandidate, sortOrder: number): BundlePlanFormItem {
  const isProxy = candidate.type === "PROXY";
  return {
    planId: candidate.id,
    selectedInboundId: isProxy ? (candidate.inbounds[0]?.id ?? null) : null,
    trafficGb: isProxy
      ? candidate.pricingMode === "FIXED_PACKAGE"
        ? candidate.fixedTrafficGb
        : (candidate.minTrafficGb ?? 1)
      : null,
    sortOrder,
  };
}

function describeCandidate(candidate: BundlePlanCandidate) {
  if (candidate.type === "STREAMING") return "流媒体套餐";
  if (candidate.pricingMode === "FIXED_PACKAGE") {
    return `代理套餐 · 固定 ${candidate.fixedTrafficGb ?? 0} GB`;
  }
  return `代理套餐 · ${candidate.minTrafficGb ?? 0}-${candidate.maxTrafficGb ?? 0} GB`;
}

function formatCandidateInbound(inbound: BundlePlanCandidate["inbounds"][number]) {
  return inbound.displayName || inbound.tag || `${inbound.protocol}:${inbound.port}`;
}

export function BundleConfigSection({
  fieldId,
  candidates,
  bundleItems,
  setBundleItems,
  plan,
}: Props) {
  const candidateMap = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const selectableCandidates = candidates.filter(
    (candidate) => !bundleItems.some((item) => item.planId === candidate.id),
  );

  function addItem() {
    const candidate = selectableCandidates[0];
    if (!candidate) return;
    setBundleItems((prev) => [...prev, defaultItem(candidate, (prev.length + 1) * 10)]);
  }

  function updateItem(index: number, updater: (item: BundlePlanFormItem) => BundlePlanFormItem) {
    setBundleItems((prev) => prev.map((item, itemIndex) => (itemIndex === index ? updater(item) : item)));
  }

  function removeItem(index: number) {
    setBundleItems((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor={fieldId("price")}>聚合套餐售价</Label>
        <Input
          id={fieldId("price")}
          name="price"
          type="number"
          step="0.01"
          min="0"
          placeholder="例如 99"
          defaultValue={plan?.price ?? ""}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          管理员自己购买会自动免费开通，普通用户按这里的售价支付。
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Label>打包内容</Label>
            <p className="mt-1 text-xs text-muted-foreground">
              可把多个代理/流媒体小套餐打包成一个大套餐出售。
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addItem} disabled={selectableCandidates.length === 0}>
            <Plus className="size-4" />
            添加子套餐
          </Button>
        </div>

        {bundleItems.length === 0 && (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
            还没有添加子套餐。
          </div>
        )}

        {bundleItems.map((item, index) => {
          const candidate = candidateMap.get(item.planId);
          const selectedIds = new Set(bundleItems.map((current, currentIndex) => currentIndex === index ? "" : current.planId));
          return (
            <div key={`${item.planId}-${index}`} className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <div>
                  <Label>子套餐</Label>
                  <Select
                    value={item.planId}
                    onValueChange={(planId) => {
                      if (!planId) return;
                      const next = candidateMap.get(planId);
                      if (!next) return;
                      updateItem(index, () => defaultItem(next, item.sortOrder));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择子套餐">
                        {(value) => candidateMap.get(value as string)?.name ?? "选择子套餐"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {candidates.map((option) => (
                        <SelectItem key={option.id} value={option.id} disabled={selectedIds.has(option.id)}>
                          {option.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {candidate && (
                    <p className="mt-1 text-xs text-muted-foreground">{describeCandidate(candidate)}</p>
                  )}
                </div>
                <Button type="button" variant="ghost" size="icon" className="self-end" onClick={() => removeItem(index)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>

              {candidate?.type === "PROXY" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>入站线路</Label>
                    <Select
                      value={item.selectedInboundId ?? ""}
                      onValueChange={(selectedInboundId) => updateItem(index, (current) => ({ ...current, selectedInboundId: selectedInboundId || null }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择入站">
                          {(value) => {
                            const inbound = candidate.inbounds.find((item) => item.id === value);
                            return inbound ? formatCandidateInbound(inbound) : "选择入站";
                          }}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {candidate.inbounds.map((inbound) => (
                          <SelectItem key={inbound.id} value={inbound.id}>
                            {formatCandidateInbound(inbound)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>打包流量 GB</Label>
                    <Input
                      type="number"
                      min={candidate.pricingMode === "FIXED_PACKAGE" ? candidate.fixedTrafficGb ?? 1 : candidate.minTrafficGb ?? 1}
                      max={candidate.pricingMode === "FIXED_PACKAGE" ? candidate.fixedTrafficGb ?? undefined : candidate.maxTrafficGb ?? undefined}
                      value={item.trafficGb ?? ""}
                      disabled={candidate.pricingMode === "FIXED_PACKAGE"}
                      onChange={(event) => updateItem(index, (current) => ({
                        ...current,
                        trafficGb: event.target.value ? Number(event.target.value) : null,
                      }))}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
