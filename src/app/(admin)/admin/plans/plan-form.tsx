"use client";

import type { FormEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createPlan, updatePlan } from "@/actions/admin/plans";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "sonner";
import {
  PlanBasicsFields,
  PlanLimitsFields,
  PlanPolicySection,
  ProxyNodeFields,
  ProxyPricingFields,
  StreamingConfigSection,
} from "./plan-form-sections";
import type {
  PlanFormValue,
  StreamingServiceOption,
} from "./plan-form-types";
import { usePlanFormState } from "./use-plan-form-state";

export type { PlanFormValue, StreamingServiceOption } from "./plan-form-types";

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-4 rounded-lg border border-border bg-muted/20 p-4">
      <legend className="px-1.5 text-sm font-semibold">{title}</legend>
      {children}
    </fieldset>
  );
}

export function PlanForm({
  plan,
  services,
  triggerLabel,
  triggerVariant = "default",
}: {
  plan?: PlanFormValue;
  services: StreamingServiceOption[];
  triggerLabel?: string;
  triggerVariant?: "default" | "outline" | "ghost";
}) {
  const isEdit = Boolean(plan);
  const router = useRouter();
  const {
    open,
    handleOpenChange,
    title,
    fieldId,
    type,
    setType,
    nodeId,
    setNodeId,
    selectedInboundIds,
    setSelectedInboundIds,
    streamingServiceId,
    setStreamingServiceId,
    pricingMode,
    setPricingMode,
    allowRenewal,
    setAllowRenewal,
    allowTrafficTopup,
    setAllowTrafficTopup,
    renewalPricingMode,
    setRenewalPricingMode,
    topupPricingMode,
    setTopupPricingMode,
    submitting,
    startSubmitting,
    finishSubmitting,
    nodes,
    inbounds,
    setInbounds,
    hasStreamingServices,
    toggleInbound,
  } = usePlanFormState({ plan, services, isEdit });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const formData = new FormData(event.currentTarget);
    formData.set("type", type);
    formData.set("allowRenewal", String(allowRenewal));
    formData.set("allowTrafficTopup", String(type === "PROXY" ? allowTrafficTopup : false));
    formData.set("pricingMode", type === "PROXY" ? pricingMode : "TRAFFIC_SLIDER");

    if (!allowRenewal) {
      formData.delete("renewalPrice");
      formData.delete("renewalPricingMode");
      formData.delete("renewalDurationDays");
      formData.delete("renewalMinDays");
      formData.delete("renewalMaxDays");
      formData.delete("renewalTrafficGb");
    } else if (renewalPricingMode === "FIXED_DURATION") {
      formData.delete("renewalMinDays");
      formData.delete("renewalMaxDays");
    } else {
      formData.delete("renewalDurationDays");
    }
    if (type !== "PROXY" || !allowTrafficTopup) {
      formData.delete("topupPricingMode");
      formData.delete("topupPricePerGb");
      formData.delete("topupFixedPrice");
      formData.delete("minTopupGb");
      formData.delete("maxTopupGb");
    }

    if (type === "PROXY") {
      if (!nodeId) {
        toast.error("请先选择节点");
        return;
      }
      if (selectedInboundIds.length === 0) {
        toast.error("请至少勾选一个可售入站");
        return;
      }

      formData.set("nodeId", nodeId);
      formData.set("inboundId", selectedInboundIds[0]);
      formData.set("inboundIds", selectedInboundIds.join(","));
      formData.delete("streamingServiceId");
    } else {
      if (!streamingServiceId) {
        toast.error("请先选择流媒体服务");
        return;
      }
      formData.set("streamingServiceId", streamingServiceId);
      formData.delete("nodeId");
      formData.delete("inboundId");
      formData.delete("inboundIds");
      formData.delete("totalTrafficGb");
      formData.delete("topupPricingMode");
      formData.delete("topupPricePerGb");
      formData.delete("topupFixedPrice");
      formData.delete("minTopupGb");
      formData.delete("maxTopupGb");
      formData.delete("renewalTrafficGb");
    }

    try {
      startSubmitting();
      if (isEdit) {
        await updatePlan(plan!.id, formData);
      } else {
        await createPlan(formData);
      }
      toast.success(isEdit ? "套餐更新成功" : "套餐创建成功");
      handleOpenChange(false);
      router.refresh();
    } catch (error) {
      toast.error(getErrorMessage(error, `${isEdit ? "更新" : "创建"}失败`));
    } finally {
      finishSubmitting();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={<Button variant={triggerVariant} size={isEdit ? "sm" : "default"} />}
      >
        {triggerLabel ?? (isEdit ? "编辑" : "创建套餐")}
      </DialogTrigger>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(event) => void handleSubmit(event)} className="grid gap-4 lg:grid-cols-2">
          {/* Left column: basics + resource config */}
          <div className="space-y-4">
            <FormSection title="基础信息">
              <PlanBasicsFields
                fieldId={fieldId}
                isEdit={isEdit}
                type={type}
                setType={setType}
                plan={plan}
                services={services}
                streamingServiceId={streamingServiceId}
                setStreamingServiceId={setStreamingServiceId}
                hasStreamingServices={hasStreamingServices}
                setInbounds={setInbounds}
                setSelectedInboundIds={setSelectedInboundIds}
                setAllowTrafficTopup={setAllowTrafficTopup}
              />
            </FormSection>

            {type === "PROXY" ? (
              <FormSection title="节点与线路">
                <ProxyNodeFields
                  fieldId={fieldId}
                  nodes={nodes}
                  nodeId={nodeId}
                  setNodeId={setNodeId}
                  inbounds={inbounds}
                  setInbounds={setInbounds}
                  selectedInboundIds={selectedInboundIds}
                  setSelectedInboundIds={setSelectedInboundIds}
                  toggleInbound={toggleInbound}
                />
              </FormSection>
            ) : (
              <FormSection title="服务与定价">
                <StreamingConfigSection
                  fieldId={fieldId}
                  plan={plan}
                  services={services}
                  streamingServiceId={streamingServiceId}
                  setStreamingServiceId={setStreamingServiceId}
                  hasStreamingServices={hasStreamingServices}
                />
              </FormSection>
            )}
          </div>

          {/* Right column: pricing (proxy only) + sales policy + submit */}
          <div className="space-y-4">
            {type === "PROXY" && (
              <FormSection title="定价">
                <ProxyPricingFields
                  fieldId={fieldId}
                  plan={plan}
                  pricingMode={pricingMode}
                  setPricingMode={setPricingMode}
                  allowTrafficTopup={allowTrafficTopup}
                />
              </FormSection>
            )}

            <FormSection title="销售策略">
              <PlanLimitsFields fieldId={fieldId} plan={plan} />
              <PlanPolicySection
                fieldId={fieldId}
                type={type}
                plan={plan}
                allowRenewal={allowRenewal}
                setAllowRenewal={setAllowRenewal}
                allowTrafficTopup={allowTrafficTopup}
                setAllowTrafficTopup={setAllowTrafficTopup}
                renewalPricingMode={renewalPricingMode}
                setRenewalPricingMode={setRenewalPricingMode}
                topupPricingMode={topupPricingMode}
                setTopupPricingMode={setTopupPricingMode}
              />
            </FormSection>

            <Button type="submit" size="lg" className="w-full" disabled={submitting}>
              {submitting ? "提交中..." : (isEdit ? "保存套餐" : "创建套餐")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
