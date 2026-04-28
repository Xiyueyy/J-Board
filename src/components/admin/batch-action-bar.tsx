import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface BatchActionBarProps {
  action: (formData: FormData) => void | Promise<void>;
  children: ReactNode;
  id?: string;
  label?: string;
  className?: string;
}

interface BatchActionButtonProps {
  value?: string;
  children: ReactNode;
  name?: string;
  destructive?: boolean;
  className?: string;
}

export function BatchActionBar({
  action,
  children,
  id,
  label = "批量操作",
  className,
}: BatchActionBarProps) {
  return (
    <form
      id={id}
      action={action}
      aria-label={label}
      className={cn("flex flex-wrap gap-2 rounded-lg bg-muted/25 p-3", className)}
    >
      {children}
    </form>
  );
}

export function BatchActionButton({
  value,
  children,
  name = "action",
  destructive,
  className,
}: BatchActionButtonProps) {
  return (
    <button
      type="submit"
      name={value == null ? undefined : name}
      value={value}
      className={cn(
        "btn-base rounded-xl border px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/20",
        destructive ? "btn-danger-3d" : "btn-cream",
        className,
      )}
    >
      {children}
    </button>
  );
}
