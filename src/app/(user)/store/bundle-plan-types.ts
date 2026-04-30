export interface BundlePlanItem {
  id: string;
  name: string;
  type: "PROXY" | "STREAMING";
  durationDays: number;
  trafficGb: number | null;
  nodeName: string | null;
  serviceName: string | null;
  inboundName: string | null;
}

export interface BundlePlan {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  durationDays: number;
  price: number;
  items: BundlePlanItem[];
  totalLimit: number | null;
  perUserLimit: number | null;
  activeCount: number;
  remainingCount: number | null;
  remainingByUserLimit: number | null;
  isAvailable: boolean;
  nextAvailableAt: string | null;
}
