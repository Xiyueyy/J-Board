import { StatusBadge } from "@/components/shared/status-badge";

interface PlanAvailabilityBadgesProps {
  totalLimit: number | null;
  perUserLimit: number | null;
  remainingCount: number | null;
  inboundCount?: number;
  hasInboundOptions?: boolean;
  isAvailable: boolean;
  unavailableLabel: string;
  missingInboundLabel?: string;
}

export function PlanAvailabilityBadges({
  totalLimit,
  perUserLimit,
  remainingCount,
  inboundCount,
  hasInboundOptions,
  isAvailable,
  unavailableLabel,
  missingInboundLabel,
}: PlanAvailabilityBadgesProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <StatusBadge tone="neutral" className="text-xs">
        {totalLimit == null ? "不限量" : `剩余 ${remainingCount ?? 0}`}
      </StatusBadge>
      <StatusBadge tone="neutral" className="text-xs">
        {perUserLimit == null ? "不限购" : `限购 ${perUserLimit}`}
      </StatusBadge>
      {inboundCount != null && inboundCount > 0 && (
        <StatusBadge tone="info" className="text-xs">
          {inboundCount} 个入站
        </StatusBadge>
      )}
      {hasInboundOptions === false && missingInboundLabel && (
        <StatusBadge tone="danger" className="text-xs">
          {missingInboundLabel}
        </StatusBadge>
      )}
      {!isAvailable && (
        <StatusBadge tone="danger" className="text-xs">
          {unavailableLabel}
        </StatusBadge>
      )}
    </div>
  );
}
