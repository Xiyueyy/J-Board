import { Download, ExternalLink, FileCode2, Link2 } from "lucide-react";
import { CopyButton } from "@/components/shared/copy-button";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SubscriptionImportActionsProps {
  genericUrl: string;
  clashUrl: string;
  title?: string;
  description?: string;
  compact?: boolean;
}

function buildClashImportUrl(url: string) {
  return `clash://install-config?url=${encodeURIComponent(url)}`;
}

export function withSubscriptionFormat(url: string, format: "base64" | "uri" | "clash") {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}format=${format}`;
}

export function SubscriptionImportActions({
  genericUrl,
  clashUrl,
  title = "客户端导入",
  description = "Clash 使用 YAML 订阅；其他客户端可继续使用通用 Base64 链接。",
  compact = false,
}: SubscriptionImportActionsProps) {
  const clashImportUrl = buildClashImportUrl(clashUrl);

  return (
    <div className="rounded-2xl border border-border/70 bg-background/70 p-3 backdrop-blur">
      <div className={cn("flex flex-col gap-3", compact ? "" : "lg:flex-row lg:items-center lg:justify-between")}>
        <div className="min-w-0 space-y-1">
          <p className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-muted-foreground">
            <Link2 className="size-3.5" /> SUBSCRIPTION URL
          </p>
          <p className="truncate font-mono text-xs text-foreground/80">{genericUrl}</p>
          <p className="text-xs leading-5 text-muted-foreground">
            <span className="font-semibold text-foreground">{title}</span> · {description}
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:flex lg:shrink-0 lg:flex-wrap lg:justify-end">
          <a
            href={clashImportUrl}
            className={cn(buttonVariants({ size: "sm" }), "sm:col-span-2 lg:col-span-1")}
          >
            <ExternalLink className="size-3.5" /> Clash 一键导入
          </a>
          <CopyButton text={clashUrl} label="复制 Clash" />
          <CopyButton text={genericUrl} label="复制通用" />
          <a
            href={clashUrl}
            download
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <FileCode2 className="size-3.5" /> YAML
          </a>
          <a
            href={genericUrl}
            download
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            <Download className="size-3.5" /> 通用
          </a>
        </div>
      </div>
    </div>
  );
}
