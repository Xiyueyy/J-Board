import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function DataTable({ className, ...props }: ComponentProps<"table">) {
  return <table className={cn("w-full min-w-[760px] border-separate border-spacing-0 text-sm", className)} {...props} />;
}

export function DataTableHead({ className, ...props }: ComponentProps<"thead">) {
  return <thead className={cn("text-left", className)} {...props} />;
}

export function DataTableHeaderRow({ className, ...props }: ComponentProps<"tr">) {
  return (
    <tr
      className={cn(
        "border-b border-border/60 bg-muted/35 text-left text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function DataTableBody({ className, ...props }: ComponentProps<"tbody">) {
  return <tbody className={cn("[&_tr+tr_td]:border-t [&_tr+tr_td]:border-border/45", className)} {...props} />;
}

export function DataTableRow({ className, ...props }: ComponentProps<"tr">) {
  return <tr className={cn("group/row transition-colors duration-300 hover:bg-primary/[0.035]", className)} {...props} />;
}

export function DataTableHeadCell({ className, ...props }: ComponentProps<"th">) {
  return <th scope="col" className={cn("whitespace-nowrap px-5 py-4", className)} {...props} />;
}

export function DataTableCell({ className, ...props }: ComponentProps<"td">) {
  return <td className={cn("whitespace-nowrap px-5 py-4 align-top transition-colors", className)} {...props} />;
}

export function MutedCellText({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("text-muted-foreground", className)}>{children}</span>;
}
