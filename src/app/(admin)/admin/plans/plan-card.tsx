import { Boxes, Network, Tv } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActiveStatusBadge, StatusBadge } from "@/components/admin/status-badge";
import { DetailItem, DetailList } from "@/components/admin/detail-list";
import {
  type BundlePlanCandidate,
  PlanFormValue,
  type StreamingServiceOption,
} from "./plan-form";
import { PlanActions } from "./plan-actions";

type NumericLike = number | { toString(): string } | null | undefined;

interface PlanListItem {
  id: string;
  name: string;
  type: "PROXY" | "STREAMING" | "BUNDLE";
  description: string | null;
  durationDays: number;
  sortOrder: number;
  isActive: boolean;
  isPublic: boolean;
  price: NumericLike;
  nodeId: string | null;
  inboundId: string | null;
  streamingServiceId: string | null;
  pricingMode: "TRAFFIC_SLIDER" | "FIXED_PACKAGE";
  fixedTrafficGb: number | null;
  fixedPrice: NumericLike;
  totalLimit: number | null;
  perUserLimit: number | null;
  totalTrafficGb: number | null;
  allowRenewal: boolean;
  allowTrafficTopup: boolean;
  renewalPrice: NumericLike;
  renewalPricingMode: string;
  renewalDurationDays: number | null;
  renewalMinDays: number | null;
  renewalMaxDays: number | null;
  renewalTrafficGb: number | null;
  topupPricingMode: string;
  topupPricePerGb: NumericLike;
  topupFixedPrice: NumericLike;
  minTopupGb: number | null;
  maxTopupGb: number | null;
  pricePerGb: NumericLike;
  minTrafficGb: number | null;
  maxTrafficGb: number | null;
  node: { name: string } | null;
  inbound: { protocol: string; port: number; tag: string } | null;
  streamingService: { name: string; usedSlots: number; maxSlots: number } | null;
  inboundOptions: Array<{
    inboundId: string;
    inbound: { protocol: string; port: number; tag: string };
  }>;
  bundleItems: Array<{
    childPlanId: string;
    selectedInboundId: string | null;
    trafficGb: number | null;
    sortOrder: number;
    childPlan: { name: string; type: "PROXY" | "STREAMING" | "BUNDLE"; pricingMode: "TRAFFIC_SLIDER" | "FIXED_PACKAGE"; fixedTrafficGb: number | null };
    selectedInbound: { protocol: string; port: number; tag: string } | null;
  }>;
  _count: { subscriptions: number };
}

interface PlanCardProps {
  plan: PlanListItem;
  activeCount: number;
  services: StreamingServiceOption[];
  bundleCandidates: BundlePlanCandidate[];
  batchFormId: string;
}

function toNumber(value: NumericLike): number | null {
  return value == null ? null : Number(value);
}

function money(value: NumericLike): string {
  return `¥${Number(value ?? 0).toFixed(2)}`;
}

function renewalSummary(plan: PlanListItem) {
  if (!plan.allowRenewal) return "续费关闭";
  if (plan.renewalPricingMode === "PER_DAY") {
    return `${money(plan.renewalPrice)}/天 · ${plan.renewalMinDays ?? 1}-${plan.renewalMaxDays ?? plan.durationDays} 天`;
  }
  return `${money(plan.renewalPrice)} / ${plan.renewalDurationDays ?? plan.durationDays} 天`;
}

function topupSummary(plan: PlanListItem) {
  if (!plan.allowTrafficTopup) return "增流量关闭";
  const range = plan.maxTopupGb == null
    ? `最少 ${plan.minTopupGb ?? 1} GB`
    : `${plan.minTopupGb ?? 1}-${plan.maxTopupGb} GB`;
  if (plan.topupPricingMode === "FIXED_AMOUNT") {
    return `${money(plan.topupFixedPrice)} 固定 · ${range}`;
  }
  return `${money(plan.topupPricePerGb)}/GB · ${range}`;
}

function buildPlanFormValue(plan: PlanListItem): PlanFormValue {
  return {
    id: plan.id,
    name: plan.name,
    type: plan.type,
    description: plan.description,
    durationDays: plan.durationDays,
    sortOrder: plan.sortOrder,
    isPublic: plan.isPublic,
    price: toNumber(plan.price),
    nodeId: plan.nodeId,
    inboundId: plan.inboundId,
    inboundOptionIds: plan.inboundOptions.map((option) => option.inboundId),
    streamingServiceId: plan.streamingServiceId,
    pricingMode: plan.pricingMode,
    fixedTrafficGb: plan.fixedTrafficGb,
    fixedPrice: toNumber(plan.fixedPrice),
    totalLimit: plan.totalLimit,
    perUserLimit: plan.perUserLimit,
    totalTrafficGb: plan.totalTrafficGb,
    allowRenewal: plan.allowRenewal,
    allowTrafficTopup: plan.allowTrafficTopup,
    renewalPrice: toNumber(plan.renewalPrice),
    renewalPricingMode: plan.renewalPricingMode === "PER_DAY" ? "PER_DAY" : "FIXED_DURATION",
    renewalDurationDays: plan.renewalDurationDays,
    renewalMinDays: plan.renewalMinDays,
    renewalMaxDays: plan.renewalMaxDays,
    renewalTrafficGb: plan.renewalTrafficGb,
    topupPricingMode: plan.topupPricingMode === "FIXED_AMOUNT" ? "FIXED_AMOUNT" : "PER_GB",
    topupPricePerGb: toNumber(plan.topupPricePerGb),
    topupFixedPrice: toNumber(plan.topupFixedPrice),
    minTopupGb: plan.minTopupGb,
    maxTopupGb: plan.maxTopupGb,
    pricePerGb: toNumber(plan.pricePerGb),
    minTrafficGb: plan.minTrafficGb,
    maxTrafficGb: plan.maxTrafficGb,
    bundleItems: plan.bundleItems.map((item) => ({
      planId: item.childPlanId,
      selectedInboundId: item.selectedInboundId,
      trafficGb: item.trafficGb,
      sortOrder: item.sortOrder,
    })),
  };
}

export function PlanCard({ plan, activeCount, services, bundleCandidates, batchFormId }: PlanCardProps) {
  const remaining = plan.totalLimit == null ? null : Math.max(0, plan.totalLimit - activeCount);
  const planFormValue = buildPlanFormValue(plan);
  const Icon = plan.type === "PROXY" ? Network : plan.type === "STREAMING" ? Tv : Boxes;

  return (
    <Card>
      <CardHeader className="gap-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <input
              form={batchFormId}
              type="checkbox"
              name="planIds"
              value={plan.id}
              aria-label={`选择套餐 ${plan.name}`}
              className="mt-3 size-5 rounded-lg border-border accent-primary shadow-sm"
            />
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/10 text-primary">
              <Icon className="size-5" />
            </span>
            <div className="min-w-0 space-y-1.5">
              <CardTitle className="text-lg text-balance">{plan.name}</CardTitle>
              <p className="text-sm leading-6 text-muted-foreground text-pretty">
                {plan.description || "无描述"} · 总订阅 {plan._count.subscriptions}
              </p>
            </div>
          </div>
          <PlanActions
            isActive={plan.isActive}
            services={services}
            bundleCandidates={bundleCandidates}
            plan={planFormValue}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 p-3">
          <StatusBadge tone={plan.type === "PROXY" ? "info" : plan.type === "STREAMING" ? "warning" : "success"}>
            {plan.type === "PROXY" ? "代理套餐" : plan.type === "STREAMING" ? "流媒体套餐" : "聚合套餐"}
          </StatusBadge>
          <ActiveStatusBadge active={plan.isActive} activeLabel="上架中" inactiveLabel="已下架" />
          <StatusBadge tone={plan.isPublic ? "neutral" : "info"}>
            {plan.isPublic ? "公开" : "仅管理员"}
          </StatusBadge>
          <StatusBadge>{plan.durationDays} 天</StatusBadge>
          <StatusBadge>
            {plan.type === "PROXY"
              ? plan.pricingMode === "FIXED_PACKAGE"
                ? `${money(plan.fixedPrice)} / ${plan.fixedTrafficGb ?? 0}GB`
                : `${money(plan.pricePerGb)}/GB`
              : plan.type === "BUNDLE"
                ? `${money(plan.price)} / ${plan.bundleItems.length} 个子套餐`
                : money(plan.price)}
          </StatusBadge>
        </div>
      </CardHeader>

      <CardContent>
        {plan.type === "PROXY" ? (
          <DetailList>
            <DetailItem label="节点">{plan.node?.name ?? "未绑定"}</DetailItem>
            <DetailItem label="入站">
              {plan.inboundOptions.length > 0
                ? plan.inboundOptions
                    .map((option) => `${option.inbound.protocol}:${option.inbound.port}`)
                    .join(" / ")
                : plan.inbound
                  ? `${plan.inbound.protocol}:${plan.inbound.port}`
                  : "未绑定"}
            </DetailItem>
            <DetailItem label="售卖方式">
              {plan.pricingMode === "FIXED_PACKAGE"
                ? `固定 ${plan.fixedTrafficGb ?? 0} GB · ${money(plan.fixedPrice)}`
                : `自选 ${plan.minTrafficGb ?? 0}-${plan.maxTrafficGb ?? 0} GB`}
            </DetailItem>
            <DetailItem label="流量池">
              {plan.totalTrafficGb == null ? "未配置" : `${plan.totalTrafficGb} GB`}
            </DetailItem>
            <DetailItem label="库存">
              {plan.totalLimit == null
                ? "不限量"
                : `${activeCount}/${plan.totalLimit}${remaining === 0 ? " (已满)" : ""}`}
              {plan.perUserLimit != null ? ` · 每人限 ${plan.perUserLimit}` : ""}
            </DetailItem>
            <DetailItem label="续费 / 增流量">
              {renewalSummary(plan)} / {topupSummary(plan)}
            </DetailItem>
          </DetailList>
        ) : plan.type === "STREAMING" ? (
          <DetailList>
            <DetailItem label="绑定服务">{plan.streamingService?.name ?? "未绑定"}</DetailItem>
            <DetailItem label="服务占用">
              {plan.streamingService
                ? `${plan.streamingService.usedSlots}/${plan.streamingService.maxSlots}`
                : "-"}
            </DetailItem>
            <DetailItem label="续费">
              {renewalSummary(plan)}
            </DetailItem>
            <DetailItem label="库存">
              {plan.totalLimit == null ? "不限量" : `${activeCount}/${plan.totalLimit}`}
              {plan.perUserLimit != null ? ` · 每人限 ${plan.perUserLimit}` : ""}
            </DetailItem>
          </DetailList>
        ) : (
          <DetailList>
            <DetailItem label="打包内容">
              {plan.bundleItems.length > 0
                ? plan.bundleItems
                    .map((item) => `${item.childPlan.name}${item.trafficGb ? ` · ${item.trafficGb}GB` : ""}`)
                    .join(" / ")
                : "未配置"}
            </DetailItem>
            <DetailItem label="售价">{money(plan.price)}</DetailItem>
            <DetailItem label="库存">
              {plan.totalLimit == null ? "不限量" : `${activeCount}/${plan.totalLimit}`}
              {plan.perUserLimit != null ? ` · 每人限 ${plan.perUserLimit}` : ""}
            </DetailItem>
          </DetailList>
        )}
      </CardContent>
    </Card>
  );
}
