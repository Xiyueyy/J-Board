export interface ProxyInboundOption {
  id: string;
  protocol: "VMESS" | "VLESS" | "TROJAN" | "SHADOWSOCKS" | "HYSTERIA2";
  port: number;
  tag: string;
  displayName: string;
}

export interface ProxyPlan {
  id: string;
  name: string;
  description: string | null;
  durationDays: number;
  sortOrder: number;
  pricingMode: "TRAFFIC_SLIDER" | "FIXED_PACKAGE";
  pricePerGb: number;
  fixedTrafficGb: number | null;
  fixedPrice: number | null;
  minTrafficGb: number;
  maxTrafficGb: number;
  nodeId: string | null;
  nodeName: string;
  inboundOptions: ProxyInboundOption[];
  totalLimit: number | null;
  perUserLimit: number | null;
  activeCount: number;
  remainingCount: number | null;
  remainingByUserLimit: number | null;
  isAvailable: boolean;
  nextAvailableAt: string | null;
}
