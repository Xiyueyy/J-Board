interface SubscriptionMetricsProps {
  activeCount: number;
  historyCount: number;
  totalCount: number;
}

const metrics = [
  ["活跃", "activeCount"],
  ["历史", "historyCount"],
  ["全部", "totalCount"],
] as const;

export function SubscriptionMetrics({
  activeCount,
  historyCount,
  totalCount,
}: SubscriptionMetricsProps) {
  const values = { activeCount, historyCount, totalCount };

  return (
    <section className="grid gap-2 sm:grid-cols-3">
      {metrics.map(([label, key]) => (
        <div key={key} className="flex items-center justify-between rounded-xl border border-border bg-muted/20 px-4 py-3">
          <span className="text-xs font-medium tracking-wide text-muted-foreground">{label}</span>
          <span className="text-lg font-semibold tracking-[-0.04em] tabular-nums">{values[key]}</span>
        </div>
      ))}
    </section>
  );
}
