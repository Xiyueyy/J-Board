"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { restoreDatabaseBackup } from "@/actions/admin/backups";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "sonner";

export function RestoreBackupForm() {
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    try {
      await restoreDatabaseBackup(formData);
      toast.success("数据库恢复已执行，建议检查关键页面和容器日志");
    } catch (error) {
      toast.error(getErrorMessage(error, "恢复失败"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form action={handleSubmit} className="form-panel space-y-5">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-destructive/15 bg-destructive/10 text-destructive">
          <AlertTriangle className="size-5" />
        </span>
        <div>
          <h3 className="text-lg font-semibold tracking-tight">恢复数据库</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            支持上传 SQL 备份文件或直接粘贴 SQL。恢复会覆盖当前数据库对象，请确认备份来源可信。
          </p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-2">
          <Label htmlFor="sqlFile">SQL 备份文件</Label>
          <Input id="sqlFile" name="sqlFile" type="file" accept=".sql,text/plain" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmation">确认口令</Label>
          <Input id="confirmation" name="confirmation" placeholder="请输入 RESTORE" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="sqlText">或粘贴 SQL 内容</Label>
        <Textarea id="sqlText" name="sqlText" rows={8} placeholder="-- paste sql backup here" />
      </div>

      <Button type="submit" size="lg" variant="destructive" disabled={loading} className="w-full sm:w-auto">
        {loading ? "恢复中..." : "执行恢复"}
      </Button>
    </form>
  );
}
