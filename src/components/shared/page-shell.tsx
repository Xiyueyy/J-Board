import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageShellProps {
  children: ReactNode;
  className?: string;
}

interface PageHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  className?: string;
}

interface SectionHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

interface EmptyStateProps {
  title: string;
  description?: string;
  eyebrow?: string;
  icon?: ReactNode;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function PageShell({ children, className }: PageShellProps) {
  return (
    <div className={cn("mx-auto flex w-full max-w-[88rem] flex-col gap-8", className)}>
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-4 md:flex-row md:items-end md:justify-between", className)}>
      <div className="min-w-0 space-y-2">
        {eyebrow && (
          <p className="text-xs font-medium tracking-wide text-muted-foreground">
            {eyebrow}
          </p>
        )}
        <h1 className="text-display max-w-4xl text-2xl font-semibold text-balance sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground text-pretty">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function SectionHeader({
  title,
  description,
  actions,
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0 space-y-1">
        <h3 className="text-lg font-semibold tracking-[-0.02em] text-balance">{title}</h3>
        {description && (
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground text-pretty">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  eyebrow,
  icon,
  action,
  secondaryAction,
  children,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "surface-card overflow-hidden rounded-xl border-dashed px-6 py-14 text-center",
        className,
      )}
    >
      <div className="mx-auto flex max-w-md flex-col items-center gap-3">
        {icon && (
          <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            {icon}
          </div>
        )}
        <div className="space-y-1.5">
          {eyebrow && (
            <p className="text-xs font-medium tracking-wide text-muted-foreground">
              {eyebrow}
            </p>
          )}
          <h3 className="text-base font-semibold text-balance">{title}</h3>
          {description && (
            <p className="text-sm leading-6 text-muted-foreground text-pretty">{description}</p>
          )}
        </div>
        {children}
        {(action || secondaryAction) && (
          <div className="flex flex-wrap justify-center gap-2 pt-1">
            {action}
            {secondaryAction}
          </div>
        )}
      </div>
    </div>
  );
}
