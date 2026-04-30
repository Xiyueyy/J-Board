export const RECOMMENDATION_CARRIERS = [
  "jx_telecom",
  "jx_unicom",
  "jx_mobile",
  "sh_telecom",
  "sh_unicom",
  "sh_mobile",
] as const;

export const latencyCarrierOrder: string[] = [...RECOMMENDATION_CARRIERS, "telecom", "unicom", "mobile"];

export const carrierLabels: Record<string, string> = {
  jx_telecom: "江西电信",
  jx_unicom: "江西联通",
  jx_mobile: "江西移动",
  sh_telecom: "上海电信",
  sh_unicom: "上海联通",
  sh_mobile: "上海移动",
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
