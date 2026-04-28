import { NextResponse } from "next/server";
import { getLatencyRecommendations } from "@/services/latency-recommendations";

export async function GET() {
  const items = await getLatencyRecommendations();
  return NextResponse.json({
    items,
    updatedAt: new Date().toISOString(),
    refreshIntervalMs: 5 * 60 * 1000,
  }, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
