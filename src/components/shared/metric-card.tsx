import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: ReactNode;
  description?: ReactNode;
  className?: string;
  valueClassName?: string;
}

export function MetricCard({
  label,
  value,
  description,
  className,
  valueClassName,
}: MetricCardProps) {
  return (
    <Card className={cn("min-h-28", className)}>
      <CardHeader className="pb-1">
        <CardTitle className="text-xs font-medium tracking-wide text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className={cn("text-display text-2xl font-semibold tabular-nums", valueClassName)}>{value}</p>
        {description && <p className="mt-1.5 text-xs leading-5 text-muted-foreground text-pretty">{description}</p>}
      </CardContent>
    </Card>
  );
}
