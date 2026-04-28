import { requireAdminApiSession } from "@/lib/admin-api";
import { createDatabaseBackupSql } from "@/services/database-backup";

export async function GET() {
  const { errorResponse } = await requireAdminApiSession();
  if (errorResponse) {
    return errorResponse;
  }

  const sql = await createDatabaseBackupSql();
  return new Response(sql, {
    headers: {
      "Content-Type": "application/sql; charset=utf-8",
      "Content-Disposition": `attachment; filename="jboard-db-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.sql"`,
    },
  });
}
