import { NextResponse } from "next/server";
import { generateSubscriptionContent } from "@/services/subscription";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 401 });
  }

  const sub = await prisma.userSubscription.findUnique({
    where: { id },
  });

  if (!sub || sub.downloadToken !== token) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  if (sub.status !== "ACTIVE") {
    return NextResponse.json({ error: "Subscription inactive" }, { status: 403 });
  }

  const content = await generateSubscriptionContent(id);
  return new Response(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="jboard-sub.txt"`,
    },
  });
}
