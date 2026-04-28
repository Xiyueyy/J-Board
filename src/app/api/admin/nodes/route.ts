import { prisma } from "@/lib/prisma";
import { jsonOk } from "@/lib/api-response";
import { requireAdminApiSession } from "@/lib/admin-api";

export async function GET() {
  const { errorResponse } = await requireAdminApiSession();
  if (errorResponse) {
    return errorResponse;
  }

  const nodes = await prisma.nodeServer.findMany({
    where: { status: "active" },
    select: { id: true, name: true },
  });

  return jsonOk(nodes);
}
