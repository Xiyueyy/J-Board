"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RenewalButton } from "./_components/renewal-button";
import { ResetAccessButton } from "./_components/reset-access-button";
import { TrafficTopupDialog } from "./_components/traffic-topup-dialog";

interface RenewalConfig {
  durationDays: number;
  renewalPrice: number | null;
  renewalPricingMode: string;
  renewalDurationDays: number | null;
  renewalMinDays: number | null;
  renewalMaxDays: number | null;
}

interface TopupConfig {
  topupPricingMode: string;
  topupPricePerGb: number | null;
  topupFixedPrice: number | null;
  minTopupGb: number | null;
  maxTopupGb: number | null;
}

interface Props {
  subscriptionId: string;
  type: "PROXY" | "STREAMING" | "BUNDLE";
  allowRenewal: boolean;
  allowTrafficTopup: boolean;
  trafficPoolRemainingGb: number | null;
  renewalConfig: RenewalConfig;
  topupConfig: TopupConfig;
}

export function SubscriptionActions({
  subscriptionId,
  type,
  allowRenewal,
  allowTrafficTopup,
  trafficPoolRemainingGb,
  renewalConfig,
  topupConfig,
}: Props) {
  return (
    <div className="flex flex-wrap gap-2 rounded-lg border border-border bg-background p-2">
      <Link
        href={`/subscriptions/${subscriptionId}`}
        className={cn(buttonVariants({ size: "sm", variant: "outline" }), "flex-1 sm:flex-none")}
      >
        详情
        <ArrowUpRight className="size-3.5" />
      </Link>
      {type === "PROXY" && <ResetAccessButton subscriptionId={subscriptionId} />}
      {allowRenewal && <RenewalButton subscriptionId={subscriptionId} config={renewalConfig} />}
      {allowTrafficTopup && (
        <TrafficTopupDialog
          subscriptionId={subscriptionId}
          trafficPoolRemainingGb={trafficPoolRemainingGb}
          config={topupConfig}
        />
      )}
    </div>
  );
}
