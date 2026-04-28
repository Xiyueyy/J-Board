import type { TrafficLog } from "@prisma/client";
import { TrafficLogList, TrafficLogListSkeleton } from "@/components/subscriptions/traffic-log-list";

export function TrafficLogs({ logs }: { logs: TrafficLog[] }) {
  return <TrafficLogList logs={logs} />;
}

export function TrafficLogsSkeleton() {
  return <TrafficLogListSkeleton />;
}
