import { batchPlanOperation } from "@/actions/admin/plans";
import { BatchActionBar, BatchActionButton } from "@/components/admin/batch-action-bar";
import { EmptyState } from "@/components/shared/page-shell";
import { PlanCard } from "../plan-card";
import { PlanForm, type BundlePlanCandidate, type StreamingServiceOption } from "../plan-form";
import type { AdminPlanRow } from "../plans-data";

export const PLAN_BATCH_FORM_ID = "plan-batch-form";

export function PlansList({
  plans,
  activeCountMap,
  services,
  bundleCandidates,
}: {
  plans: AdminPlanRow[];
  activeCountMap: Map<string, number>;
  services: StreamingServiceOption[];
  bundleCandidates: BundlePlanCandidate[];
}) {
  return (
    <>
      <BatchActionBar id={PLAN_BATCH_FORM_ID} action={batchPlanOperation}>
        <BatchActionButton value="enable">批量上架</BatchActionButton>
        <BatchActionButton value="disable">批量下架</BatchActionButton>
        <BatchActionButton value="delete" destructive>
          批量彻底删除
        </BatchActionButton>
      </BatchActionBar>
      <div className="grid gap-5">
        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            activeCount={activeCountMap.get(plan.id) ?? 0}
            services={services}
            bundleCandidates={bundleCandidates}
            batchFormId={PLAN_BATCH_FORM_ID}
          />
        ))}
        {plans.length === 0 && (
          <EmptyState
            title="暂无套餐"
            description="创建第一个套餐后，用户就可以在商店中购买。"
            action={<PlanForm services={services} bundleCandidates={bundleCandidates} triggerLabel="创建套餐" />}
          />
        )}
      </div>
    </>
  );
}
