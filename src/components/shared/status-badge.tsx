import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusTone = "success" | "neutral" | "warning" | "danger" | "info";

const toneClasses: Record<StatusTone, string> = {
  success: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  neutral: "border-border bg-muted/65 text-muted-foreground",
  warning: "border-amber-500/20 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  danger: "border-destructive/20 bg-destructive/10 text-destructive",
  info: "border-primary/20 bg-primary/10 text-primary",
};

export function StatusBadge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: StatusTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn("h-6 rounded-full px-2.5 font-semibold", toneClasses[tone], className)}>
      {children}
    </Badge>
  );
}

export function ActiveStatusBadge({
  active,
  activeLabel = "启用中",
  inactiveLabel = "已停用",
}: {
  active: boolean;
  activeLabel?: string;
  inactiveLabel?: string;
}) {
  return (
    <StatusBadge tone={active ? "success" : "neutral"}>
      {active ? activeLabel : inactiveLabel}
    </StatusBadge>
  );
}
