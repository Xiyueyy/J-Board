"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-auth";
import { actorFromSession, recordAuditLog } from "@/services/audit";
import { restoreDatabaseBackupFile, restoreDatabaseBackupSql } from "@/services/database-backup";

export async function restoreDatabaseBackup(formData: FormData) {
  const session = await requireAdmin();
  const sqlText = String(formData.get("sqlText") || "").trim();
  const file = formData.get("sqlFile");
  const confirmation = String(formData.get("confirmation") || "");

  if (confirmation !== "RESTORE") {
    throw new Error("请输入 RESTORE 确认恢复操作");
  }

  if (file instanceof File && file.size > 0) {
    await restoreDatabaseBackupFile(file);
  } else if (sqlText) {
    await restoreDatabaseBackupSql(sqlText);
  } else {
    throw new Error("请上传 SQL 备份文件或粘贴 SQL 内容");
  }

  await recordAuditLog({
    actor: actorFromSession(session),
    action: "backup.restore",
    targetType: "Database",
    message: "执行数据库恢复",
  });

  revalidatePath("/admin/backups");
}
