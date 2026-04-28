import type { OrderStatus } from "@prisma/client";
import type { StatusTone } from "@/components/shared/status-badge";
export {
  getOrderStatusTone,
  orderKindLabels,
  orderStatusLabels,
} from "@/components/shared/domain-badges";

export function formatOrderTraffic(trafficGb: number | null) {
  return trafficGb === null ? "—" : `${trafficGb} GB`;
}

export function formatOrderAmount(amount: { toString(): string } | number | string) {
  return `¥${Number(amount).toFixed(2)}`;
}

export type { OrderStatus, StatusTone };
