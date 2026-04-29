import type { Prisma, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parsePage } from "@/lib/utils";

const adminUserInclude = {
  invitedBy: {
    select: {
      email: true,
    },
  },
  _count: {
    select: {
      subscriptions: true,
      orders: true,
      invitedUsers: true,
    },
  },
} satisfies Prisma.UserInclude;

export type AdminUserRow = Prisma.UserGetPayload<{
  include: typeof adminUserInclude;
}>;

export async function getAdminUsers(
  searchParams: Record<string, string | string[] | undefined>,
) {
  const { page, skip, pageSize } = parsePage(searchParams);
  const q = typeof searchParams.q === "string" ? searchParams.q.trim() : "";
  const role = typeof searchParams.role === "string" ? searchParams.role : "";
  const status = typeof searchParams.status === "string" ? searchParams.status : "";

  const where = {
    ...(role ? { role: role as "ADMIN" | "USER" } : {}),
    ...(status ? { status: status as UserStatus } : {}),
    ...(q
      ? {
          OR: [
            { email: { contains: q, mode: "insensitive" as const } },
            { name: { contains: q, mode: "insensitive" as const } },
            { inviteCode: { contains: q, mode: "insensitive" as const } },
            { invitedBy: { email: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  } satisfies Prisma.UserWhereInput;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: adminUserInclude,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ]);

  return { users, total, page, pageSize, filters: { q, role, status } };
}
