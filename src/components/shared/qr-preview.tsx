"use client";

import { QRCodeSVG } from "qrcode.react";
import { CopyButton } from "@/components/shared/copy-button";

export function QrPreview({
  label,
  value,
  alt,
}: {
  label: string;
  value: string;
  alt: string;
}) {
  return (
    <div className="group rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/20">
      <p className="text-xs font-medium tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-2 flex justify-center rounded-lg bg-white p-3">
        <QRCodeSVG
          value={value}
          size={168}
          className="rounded-xl"
          role="img"
          aria-label={alt}
        />
      </div>
      <div className="mt-3 flex items-center justify-center">
        <CopyButton text={value} />
      </div>
    </div>
  );
}
