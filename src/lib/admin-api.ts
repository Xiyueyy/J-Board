import { jsonError } from "./api-response";
import { getActiveSession } from "./require-auth";

export async function requireAdminApiSession() {
  const session = await getActiveSession();
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
