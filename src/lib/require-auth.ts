import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { prisma } from "./prisma";
import { getActiveSubscriptionRiskRestriction } from "@/services/subscription-risk-review";

export async function getActiveSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, role: true, status: true },
  });

  if (!user || user.status !== "ACTIVE") return null;

  session.user.id = user.id;
  session.user.email = user.email;
  session.user.name = user.name;
  session.user.role = user.role;

  return session;
}

export async function requireAdmin() {
  const session = await getActiveSession();
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("无权限");
  }
  return session;
}

export async function requireAuth(options: { allowDuringRiskRestriction?: boolean } = {}) {
  const session = await getActiveSession();
  if (!session) {
    throw new Error("未登录");
  }

  if (session.user.role !== "ADMIN" && !options.allowDuringRiskRestriction) {
    const restriction = await getActiveSubscriptionRiskRestriction(session.user.id);
    if (restriction) {
      throw new Error("账户存在未处理的订阅风控限制，请先新建工单联系客服");
    }
  }

  return session;
}
