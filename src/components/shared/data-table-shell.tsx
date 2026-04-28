import type { ReactNode } from "react";
import { EmptyState } from "@/components/shared/page-shell";
import { cn } from "@/lib/utils";

interface DataTableShellProps {
  children: ReactNode;
  toolbar?: ReactNode;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  emptyIcon?: ReactNode;
  scrollHint?: string;
  className?: string;
}

export function DataTableShell({
  children,
  toolbar,
  isEmpty = false,
  emptyTitle = "暂无数据",
  emptyDescription,
  emptyAction,
  emptyIcon,
  scrollHint = "左右滑动查看更多列",
  className,
}: DataTableShellProps) {
  return (
    <div className={cn("table-shell-premium overflow-hidden rounded-xl", className)}>
      {toolbar && <div className="border-b border-border/50 bg-muted/20 p-1">{toolbar}</div>}
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-card to-transparent md:hidden" />
        <div
          aria-label="可横向滚动的数据表"
          className="overflow-x-auto focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/20"
          role="region"
          tabIndex={0}
        >
          {children}
        </div>
      </div>
      {scrollHint && !isEmpty && (
        <p className="border-t border-border/40 px-5 py-3 text-xs text-muted-foreground md:hidden">
          {scrollHint}
        </p>
      )}
      {isEmpty && (
        <div className="border-t border-border/50 p-4">
          <EmptyState
            icon={emptyIcon}
            title={emptyTitle}
            description={emptyDescription}
            action={emptyAction}
            className="border-0 bg-transparent py-12 shadow-none"
          />
        </div>
      )}
    </div>
  );
}
