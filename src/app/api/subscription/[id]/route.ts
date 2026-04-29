import { NextResponse } from "next/server";
import {
  buildSubscriptionUserInfo,
  generateSubscriptionContent,
  getSubscriptionContentType,
  getSubscriptionFilename,
  resolveSubscriptionFormat,
} from "@/services/subscription";
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

  const format = resolveSubscriptionFormat(url.searchParams, req.headers.get("user-agent"));
  const content = await generateSubscriptionContent(id, format);
  const userInfo = buildSubscriptionUserInfo({
    upload: 0,
    download: sub.trafficUsed,
    total: sub.trafficLimit,
    expire: sub.endDate,
  });
  const headers = new Headers({
    "Content-Type": getSubscriptionContentType(format),
    "Content-Disposition": `attachment; filename="${getSubscriptionFilename("jboard-sub", format)}"`,
    "Cache-Control": "no-store",
    "profile-update-interval": "12",
    "profile-web-page-url": `${url.origin}/subscriptions/${id}`,
  });
  if (userInfo) headers.set("Subscription-Userinfo", userInfo);

  return new Response(content, {
    headers,
  });
}
