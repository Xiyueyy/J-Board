import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function DetailList({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn("grid gap-3 text-sm sm:grid-cols-2", className)}>{children}</dl>;
}

export function DetailItem({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-border bg-muted/25 px-3 py-2.5", className)}>
      <dt className="text-xs font-medium tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1.5 min-w-0 font-medium text-foreground text-pretty">{children}</dd>
    </div>
  );
}
