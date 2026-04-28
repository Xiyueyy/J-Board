import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";

interface StorePlanHeaderProps {
  name: string;
  meta?: string | null;
  price: string;
  priceSuffix: string;
  eyebrow?: ReactNode;
}

export function StorePlanHeader({ name, meta, price, priceSuffix, eyebrow = "PROXY" }: StorePlanHeaderProps) {
  return (
    <div className="px-5 pt-5 pb-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1.5">
          <div className="inline-flex rounded-md border border-primary/15 bg-primary/10 px-2 py-0.5 text-xs font-medium tracking-wide text-primary">
            {eyebrow}
          </div>
          <div>
            <h3 className="text-lg font-semibold tracking-[-0.02em] text-balance">{name}</h3>
            {meta && <p className="mt-0.5 text-sm text-muted-foreground">{meta}</p>}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-2xl font-semibold tracking-[-0.04em] text-primary tabular-nums">{price}</p>
          <p className="text-xs text-muted-foreground">{priceSuffix}</p>
        </div>
      </div>
    </div>
  );
}

export function StorePlanDescription({ description }: { description: string | null }) {
  if (!description) return null;

  return (
    <div className="px-5 pb-3">
      <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm leading-6 text-muted-foreground text-pretty [&_a]:text-primary [&_a]:underline [&_h1]:text-base [&_h1]:font-semibold [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-medium [&_li]:my-0 [&_ol]:my-1 [&_p]:my-1 [&_ul]:my-1">
        <ReactMarkdown>{description}</ReactMarkdown>
      </div>
    </div>
  );
}
