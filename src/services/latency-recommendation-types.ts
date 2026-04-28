export const RECOMMENDATION_CARRIERS = ["telecom", "unicom", "mobile"] as const;

export const carrierLabels: Record<string, string> = {
  telecom: "电信",
  unicom: "联通",
  mobile: "移动",
};

export interface LatencyRecommendation {
  carrier: string;
  carrierLabel: string;
  nodeId: string;
  nodeName: string;
  planId: string;
  planName: string;
  latencyMs: number;
  checkedAt: string;
}
