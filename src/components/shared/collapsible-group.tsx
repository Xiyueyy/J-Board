"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface CollapsibleGroupProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

export function CollapsibleGroup({
  title,
  subtitle,
  children,
  defaultOpen = false,
}: CollapsibleGroupProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="surface-card rounded-xl p-4">
      <button
        type="button"
        className="flex w-full cursor-pointer items-center justify-between gap-4 rounded-lg px-1 py-1 text-left focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/15"
        onClick={() => setOpen((prev) => !prev)}
      >
        <div>
          <h4 className="text-base font-semibold tracking-[-0.02em]">{title}</h4>
          <p className="mt-0.5 text-sm leading-6 text-muted-foreground">{subtitle}</p>
        </div>
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted/50 transition-transform duration-200",
            open && "rotate-180",
          )}
        >
          <ChevronDown className="size-4" />
        </span>
      </button>
      {open && <div className="mt-4">{children}</div>}
    </div>
  );
}
