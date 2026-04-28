import type { Prisma } from "@prisma/client";
import { prisma, type DbClient } from "@/lib/prisma";

export interface AuditActor {
  userId?: string;
  email?: string;
  role?: "ADMIN" | "USER";
}

export interface AuditEntryInput {
  actor?: AuditActor;
  action: string;
  targetType: string;
  targetId?: string | null;
  targetLabel?: string | null;
  message: string;
  metadata?: Prisma.InputJsonValue;
}

export function actorFromSession(session: {
  user: {
    id: string;
    email?: string | null;
    role?: string | null;
  };
}): AuditActor {
  return {
    userId: session.user.id,
    email: session.user.email ?? undefined,
    role:
      session.user.role === "ADMIN" || session.user.role === "USER"
        ? session.user.role
        : undefined,
  };
}

export async function recordAuditLog(
  input: AuditEntryInput,
  db: DbClient = prisma,
) {
  await db.auditLog.create({
    data: {
      actorUserId: input.actor?.userId ?? null,
      actorEmail: input.actor?.email ?? null,
      actorRole: input.actor?.role ?? null,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      targetLabel: input.targetLabel ?? null,
      message: input.message,
      metadata: input.metadata,
    },
  });
}
