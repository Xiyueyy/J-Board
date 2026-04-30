import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateAgent, isAuthError } from "@/lib/agent-auth";

const VALID_REPORT_STATUSES = new Set(["SUCCEEDED", "FAILED"]);
const RUNNING_TIMEOUT_MS = 30 * 60 * 1000;

export async function GET(req: Request) {
  const auth = await authenticateAgent(req);
  if (isAuthError(auth)) return auth;
  const { nodeId } = auth;

  const staleBefore = new Date(Date.now() - RUNNING_TIMEOUT_MS);

  const command = await prisma.$transaction(async (tx) => {
    await tx.nodeAgentCommand.updateMany({
      where: {
        nodeId,
        status: "RUNNING",
        startedAt: { lt: staleBefore },
      },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        message: "Agent command timed out before reporting result.",
      },
    });

    const pending = await tx.nodeAgentCommand.findFirst({
      where: { nodeId, status: "PENDING" },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });

    if (!pending) return null;

    return tx.nodeAgentCommand.update({
      where: { id: pending.id },
      data: {
        status: "RUNNING",
        startedAt: new Date(),
        attempts: { increment: 1 },
      },
      select: {
        id: true,
        type: true,
        payload: true,
      },
    });
  });

  return NextResponse.json({ command });
}

export async function POST(req: Request) {
  const auth = await authenticateAgent(req);
  if (isAuthError(auth)) return auth;
  const { nodeId } = auth;

  let body: { id?: string; status?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体不是有效 JSON" }, { status: 400 });
  }

  const id = String(body.id ?? "").trim();
  const status = String(body.status ?? "").trim().toUpperCase();
  if (!id || !VALID_REPORT_STATUSES.has(status)) {
    return NextResponse.json({ error: "缺少命令 ID 或状态不合法" }, { status: 400 });
  }

  const result = await prisma.nodeAgentCommand.updateMany({
    where: { id, nodeId },
    data: {
      status,
      message: body.message?.slice(0, 1000) ?? null,
      completedAt: new Date(),
    },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "命令不存在" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
