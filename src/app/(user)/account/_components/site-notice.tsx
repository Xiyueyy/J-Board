import { Megaphone } from "lucide-react";

export function SiteNotice({ notice }: { notice: string }) {
  return (
    <div className="surface-card overflow-hidden rounded-xl px-4 py-3 text-sm leading-6 text-muted-foreground">
      <div className="flex gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300">
          <Megaphone className="size-4" />
        </span>
        <div>
          <p className="text-xs font-medium tracking-wide text-amber-700 dark:text-amber-300">站点公告</p>
          <p className="mt-0.5 whitespace-pre-wrap text-pretty">{notice}</p>
        </div>
      </div>
    </div>
  );
}
