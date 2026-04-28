import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { jsonError } from "./api-response";

export async function requireAdminApiSession() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return {
      session: null,
      errorResponse: jsonError("无权限", { status: 401 }),
    };
  }

  return {
    session,
    errorResponse: null,
  };
}
