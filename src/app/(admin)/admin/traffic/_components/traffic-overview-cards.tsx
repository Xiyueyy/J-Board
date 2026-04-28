import { Activity, Power, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { TrafficOverview } from "../traffic-data";

function OverviewCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "default" | "success" | "warning";
}) {
  const toneClass =
    tone === "success"
      ? "bg-emerald-500/10 text-emerald-600"
      : tone === "warning"
        ? "bg-amber-500/10 text-amber-700"
        : "bg-primary/10 text-primary";

  return (
    <Card>
      <CardContent className="flex items-center gap-3 pt-4">
        <span className={`flex size-10 items-center justify-center rounded-lg ${toneClass}`}>
          {icon}
        </span>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-semibold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function TrafficOverviewCards({ overview }: { overview: TrafficOverview }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <OverviewCard icon={<Users className="size-4" />} label="客户端总数" value={`${overview.totalClients}`} />
      <OverviewCard icon={<Power className="size-4" />} label="启用中" value={`${overview.enabledClients}`} tone="success" />
      <OverviewCard icon={<Power className="size-4" />} label="已禁用" value={`${overview.disabledClients}`} />
      <OverviewCard icon={<Activity className="size-4" />} label="24h 有流量" value={`${overview.activeClients24h}`} tone="warning" />
    </div>
  );
}
