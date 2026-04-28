import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parsePage } from "@/lib/utils";

export async function getAuditLogs(
  searchParams: Record<string, string | string[] | undefined>,
) {
  const { page, skip, pageSize } = parsePage(searchParams, 50);
  const q = typeof searchParams.q === "string" ? searchParams.q.trim() : "";
  const action = typeof searchParams.action === "string" ? searchParams.action : "";

  const where = {
    ...(action ? { action: { startsWith: action } } : {}),
    ...(q
      ? {
          OR: [
            { action: { contains: q, mode: "insensitive" as const } },
            { targetType: { contains: q, mode: "insensitive" as const } },
            { targetLabel: { contains: q, mode: "insensitive" as const } },
            { actorEmail: { contains: q, mode: "insensitive" as const } },
            { message: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  } satisfies Prisma.AuditLogWhereInput;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { logs, total, page, pageSize, filters: { q, action } };
}

export function buildAuditLogExportHref(filters: { q: string; action: string }) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.action) params.set("action", filters.action);
  const query = params.toString();
  return `/api/admin/export/audit-logs${query ? `?${query}` : ""}`;
}
