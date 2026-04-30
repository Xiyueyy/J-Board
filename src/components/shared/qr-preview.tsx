"use client";

import { QRCodeSVG } from "qrcode.react";
import { CopyButton } from "@/components/shared/copy-button";
import { cn } from "@/lib/utils";

export function QrPreview({
  label,
  value,
  alt,
  className,
}: {
  label: string;
  value: string;
  alt: string;
  className?: string;
}) {
  return (
    <div className={cn("group min-w-0 rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/20", className)}>
      <p className="text-xs font-medium tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-2 flex justify-center rounded-lg bg-white p-3">
        <QRCodeSVG
          value={value}
          size={168}
          className="h-auto w-full max-w-[13.5rem] rounded-xl sm:max-w-[10.5rem]"
          role="img"
          aria-label={alt}
        />
      </div>
      <div className="mt-3 flex items-center justify-center">
        <CopyButton text={value} className="w-full sm:w-auto" />
      </div>
    </div>
  );
}
