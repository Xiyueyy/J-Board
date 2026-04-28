import { NextResponse } from "next/server";
import {
  generateAggregateSubscriptionContent,
  verifyAggregateSubscriptionToken,
} from "@/services/subscription";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId") ?? url.searchParams.get("user");
  const token = url.searchParams.get("token");

  if (!userId || !token) {
    return NextResponse.json({ error: "Missing subscription token" }, { status: 401 });
  }

  if (!verifyAggregateSubscriptionToken(userId, token)) {
    return NextResponse.json({ error: "Invalid subscription token" }, { status: 401 });
  }

  const content = await generateAggregateSubscriptionContent(userId);
  return new Response(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": 'attachment; filename="jboard-all-sub.txt"',
      "Cache-Control": "no-store",
    },
  });
}
