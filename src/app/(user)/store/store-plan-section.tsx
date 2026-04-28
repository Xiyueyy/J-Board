import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StorePlanSectionProps {
  id?: string;
  eyebrow?: string;
  title: string;
  children: ReactNode;
  after?: ReactNode;
  gridClassName?: string;
  stacked?: boolean;
}

export function StorePlanSection({
  id,
  eyebrow,
  title,
  children,
  after,
  gridClassName,
  stacked = false,
}: StorePlanSectionProps) {
  return (
    <section id={id} className="scroll-mt-8 space-y-6">
      <div className="max-w-2xl">
        {eyebrow && (
          <p className="mb-1.5 inline-flex rounded-md border border-primary/15 bg-primary/10 px-2 py-0.5 text-xs font-medium tracking-wide text-primary">
            {eyebrow}
          </p>
        )}
        <h2 className="font-heading text-lg font-semibold tracking-[-0.02em] sm:text-xl">{title}</h2>
      </div>
      <div className={cn(stacked ? "space-y-5" : "grid gap-6 md:grid-cols-2 xl:grid-cols-3", !stacked && gridClassName)}>
        {children}
      </div>
      {after}
    </section>
  );
}
