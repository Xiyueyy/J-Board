"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { fetchJson } from "@/lib/fetch-json";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "sonner";
import type {
  BundlePlanFormItem,
  InboundOption,
  NodeOption,
  PlanFormValue,
  PlanPricingMode,
  PlanType,
  StreamingServiceOption,
} from "./plan-form-types";

type SubmitState = "idle" | "submitting";

interface UsePlanFormStateArgs {
  plan?: PlanFormValue;
  services: StreamingServiceOption[];
  isEdit: boolean;
}

export function usePlanFormState({ plan, services, isEdit }: UsePlanFormStateArgs) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<PlanType>(plan?.type ?? "PROXY");
  const [nodeId, setNodeId] = useState(plan?.nodeId ?? "");
  const [selectedInboundIds, setSelectedInboundIds] = useState<string[]>(
    plan?.inboundOptionIds?.length ? plan.inboundOptionIds : (plan?.inboundId ? [plan.inboundId] : []),
  );
  const [streamingServiceId, setStreamingServiceId] = useState(plan?.streamingServiceId ?? "");
  const [pricingMode, setPricingMode] = useState<PlanPricingMode>(plan?.pricingMode ?? "TRAFFIC_SLIDER");
  const [bundleItems, setBundleItems] = useState<BundlePlanFormItem[]>(plan?.bundleItems ?? []);
  const [isPublic, setIsPublic] = useState(plan?.isPublic ?? true);
  const [allowRenewal, setAllowRenewal] = useState(plan?.allowRenewal ?? false);
  const [allowTrafficTopup, setAllowTrafficTopup] = useState(plan?.allowTrafficTopup ?? false);
  const [renewalPricingMode, setRenewalPricingMode] = useState<PlanFormValue["renewalPricingMode"]>(
    plan?.renewalPricingMode ?? "FIXED_DURATION",
  );
  const [topupPricingMode, setTopupPricingMode] = useState<PlanFormValue["topupPricingMode"]>(
    plan?.topupPricingMode ?? "PER_GB",
  );
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [nodes, setNodes] = useState<NodeOption[]>([]);
  const [inbounds, setInbounds] = useState<InboundOption[]>([]);
  const formId = useId();

  const hasStreamingServices = services.length > 0;
  const title = useMemo(() => (isEdit ? "编辑套餐" : "创建套餐"), [isEdit]);
  const submitting = submitState === "submitting";
  const fieldId = (name: string) => `${formId}-${name}`;

  useEffect(() => {
    if (!open) return;

    fetchJson<NodeOption[]>("/api/admin/nodes")
      .then((list) => {
        setNodes(list);
        if (type !== "PROXY") return;
        setNodeId((prev) => prev || list[0]?.id || "");
      })
      .catch((error) => {
        setNodes([]);
        toast.error(getErrorMessage(error, "节点列表加载失败"));
      });
  }, [open, type]);

  useEffect(() => {
    if (!open || type !== "PROXY" || !nodeId) return;

    let cancelled = false;
    fetchJson<InboundOption[]>(`/api/admin/nodes/${nodeId}/inbounds`)
      .then((list) => {
        if (cancelled) return;
        setInbounds(list);
        setSelectedInboundIds((prev) => {
          const valid = prev.filter((id) => list.some((inbound) => inbound.id === id));
          if (valid.length > 0) return valid;
          return list[0]?.id ? [list[0].id] : [];
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setInbounds([]);
        setSelectedInboundIds([]);
        toast.error(getErrorMessage(error, "入站列表加载失败"));
      });

    return () => {
      cancelled = true;
    };
  }, [open, type, nodeId]);

  function resetFromPlan() {
    if (!plan) return;
    setType(plan.type);
    setNodeId(plan.nodeId ?? "");
    setSelectedInboundIds(
      plan.inboundOptionIds?.length
        ? plan.inboundOptionIds
        : (plan.inboundId ? [plan.inboundId] : []),
    );
    setStreamingServiceId(plan.streamingServiceId ?? "");
    setPricingMode(plan.pricingMode ?? "TRAFFIC_SLIDER");
    setBundleItems(plan.bundleItems ?? []);
    setIsPublic(plan.isPublic ?? true);
    setAllowRenewal(plan.allowRenewal ?? false);
    setAllowTrafficTopup(plan.allowTrafficTopup ?? false);
    setRenewalPricingMode(plan.renewalPricingMode ?? "FIXED_DURATION");
    setTopupPricingMode(plan.topupPricingMode ?? "PER_GB");
    setSubmitState("idle");
  }

  function resetForCreate() {
    setType("PROXY");
    setNodeId("");
    setSelectedInboundIds([]);
    setStreamingServiceId(hasStreamingServices ? services[0].id : "");
    setPricingMode("TRAFFIC_SLIDER");
    setBundleItems([]);
    setIsPublic(true);
    setAllowRenewal(false);
    setAllowTrafficTopup(false);
    setRenewalPricingMode("FIXED_DURATION");
    setTopupPricingMode("PER_GB");
    setSubmitState("idle");
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next && plan) {
      resetFromPlan();
    }
    if (next && !isEdit) {
      resetForCreate();
    }
  }

  function toggleInbound(inboundId: string) {
    setSelectedInboundIds((prev) => {
      if (prev.includes(inboundId)) {
        return prev.filter((id) => id !== inboundId);
      }
      return [...prev, inboundId];
    });
  }

  return {
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
    bundleItems,
    setBundleItems,
    isPublic,
    setIsPublic,
    allowRenewal,
    setAllowRenewal,
    allowTrafficTopup,
    setAllowTrafficTopup,
    renewalPricingMode,
    setRenewalPricingMode,
    topupPricingMode,
    setTopupPricingMode,
    submitting,
    startSubmitting: () => setSubmitState("submitting"),
    finishSubmitting: () => setSubmitState("idle"),
    nodes,
    setNodes,
    inbounds,
    setInbounds,
    hasStreamingServices,
    toggleInbound,
  };
}
