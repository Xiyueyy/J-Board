import Image from "next/image";
import Link from "next/link";
import { FileDown, ImageIcon } from "lucide-react";
import { formatBytes } from "@/lib/utils";
import {
  buildSupportAttachmentUrl,
  isSupportImageMimeType,
} from "@/services/support";

interface AttachmentItem {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
}

export function SupportAttachmentList({
  items,
}: {
  items: AttachmentItem[];
}) {
  if (items.length === 0) {
    return null;
  }

  const imageItems = items.filter((item) => isSupportImageMimeType(item.mimeType));
  const otherItems = items.filter((item) => !isSupportImageMimeType(item.mimeType));

  return (
    <div className="mt-4 space-y-3">
      <p className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-muted-foreground">
        <FileDown className="size-3.5" /> 附件
      </p>
      {imageItems.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {imageItems.map((item) => {
            const previewUrl = buildSupportAttachmentUrl(item.id);
            const downloadUrl = buildSupportAttachmentUrl(item.id, { download: true });

            return (
              <div key={item.id} className="overflow-hidden rounded-lg border border-border bg-background">
                <Link
                  href={previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="group block"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                    <Image
                      src={previewUrl}
                      alt={item.fileName}
                      fill
                      unoptimized
                      className="object-cover transition-transform duration-500 ease-[var(--ease-fluid)] group-hover:scale-[1.045]"
                    />
                  </div>
                </Link>
                <div className="space-y-3 p-3">
                  <p className="truncate text-xs font-semibold" title={item.fileName}>
                    {item.fileName}
                  </p>
                  <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
                    <span>{formatBytes(item.size)}</span>
                    <div className="flex gap-3">
                      <Link
                        href={previewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-primary hover:underline"
                      >
                        预览
                      </Link>
                      <Link href={downloadUrl} className="font-medium hover:text-foreground hover:underline">
                        下载
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {otherItems.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {otherItems.map((item) => (
            <Link
              key={item.id}
              href={buildSupportAttachmentUrl(item.id, { download: true })}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-xs font-medium transition-colors duration-200 hover:border-primary/25 hover:bg-primary/8"
            >
              <ImageIcon className="size-3.5 text-primary" />
              <span className="max-w-48 truncate">{item.fileName}</span>
              <span className="text-muted-foreground">{formatBytes(item.size)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
