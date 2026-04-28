import type { Metadata } from "next";
import { DatabaseBackup, Download } from "lucide-react";
import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { buttonVariants } from "@/components/ui/button";
import { RestoreBackupForm } from "./restore-form";

export const metadata: Metadata = {
  title: "备份与恢复",
  description: "导出数据库备份并支持 SQL 恢复。",
};

export default function BackupsPage() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="系统"
        title="备份与恢复"
      />

      <section className="surface-card surface-lift overflow-hidden rounded-xl p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <DatabaseBackup className="size-4" />
            </span>
            <div>
              <h3 className="text-lg font-semibold tracking-tight">导出数据库</h3>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                导出为可恢复的 SQL 脚本，适合在升级、迁移和大规模配置调整前做完整备份。
              </p>
            </div>
          </div>
          <a
            href="/api/admin/backup/database"
            className={buttonVariants({ size: "lg" })}
          >
            <Download className="size-4" />
            下载 SQL 备份
          </a>
        </div>
      </section>

      <RestoreBackupForm />
    </PageShell>
  );
}
