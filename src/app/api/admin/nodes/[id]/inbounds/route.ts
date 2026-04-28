import { prisma } from "@/lib/prisma";
import { jsonOk } from "@/lib/api-response";
import { requireAdminApiSession } from "@/lib/admin-api";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { errorResponse } = await requireAdminApiSession();
  if (errorResponse) {
    return errorResponse;
  }

  const { id } = await params;
  const inbounds = await prisma.nodeInbound.findMany({
    where: { serverId: id, isActive: true },
    select: {
      id: true,
      protocol: true,
      port: true,
      tag: true,
    },
    orderBy: [{ protocol: "asc" }, { port: "asc" }],
  });

  return jsonOk(inbounds);
}
