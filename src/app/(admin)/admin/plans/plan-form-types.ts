export type PlanType = "STREAMING" | "PROXY";
export type PlanPricingMode = "TRAFFIC_SLIDER" | "FIXED_PACKAGE";

export interface NodeOption {
  id: string;
  name: string;
}

export interface InboundOption {
  id: string;
  protocol: "VMESS" | "VLESS" | "TROJAN" | "SHADOWSOCKS" | "HYSTERIA2";
  port: number;
  tag: string;
}

export interface PlanFormValue {
  id: string;
  name: string;
  type: PlanType;
  description: string | null;
  durationDays: number;
  sortOrder: number;
  price: number | null;
  nodeId: string | null;
  inboundId: string | null;
  inboundOptionIds: string[];
  streamingServiceId: string | null;
  pricingMode: PlanPricingMode;
  fixedTrafficGb: number | null;
  fixedPrice: number | null;
  totalLimit: number | null;
  perUserLimit: number | null;
  totalTrafficGb: number | null;
  allowRenewal: boolean;
  allowTrafficTopup: boolean;
  renewalPrice: number | null;
  renewalPricingMode: "PER_DAY" | "FIXED_DURATION";
  renewalDurationDays: number | null;
  renewalMinDays: number | null;
  renewalMaxDays: number | null;
  renewalTrafficGb: number | null;
  topupPricingMode: "PER_GB" | "FIXED_AMOUNT";
  topupPricePerGb: number | null;
  topupFixedPrice: number | null;
  minTopupGb: number | null;
  maxTopupGb: number | null;
  pricePerGb: number | null;
  minTrafficGb: number | null;
  maxTrafficGb: number | null;
}

export interface StreamingServiceOption {
  id: string;
  name: string;
  usedSlots: number;
  maxSlots: number;
}
