import type { Prisma, TaskKind, TaskStatus } from "@prisma/client";
import { prisma, type DbClient } from "@/lib/prisma";

export interface TaskRunInput {
  kind: TaskKind;
  title: string;
  targetType?: string | null;
  targetId?: string | null;
  payload?: Prisma.InputJsonValue;
  retryable?: boolean;
  triggeredById?: string | null;
}

export async function createTaskRun(
  input: TaskRunInput,
  db: DbClient = prisma,
) {
  return db.taskRun.create({
    data: {
      kind: input.kind,
      title: input.title,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      payload: input.payload,
      retryable: input.retryable ?? false,
      triggeredById: input.triggeredById ?? null,
      status: "PENDING",
    },
  });
}

export async function updateTaskRun(
  id: string,
  data: {
    status?: TaskStatus;
    result?: Prisma.InputJsonValue;
    errorMessage?: string | null;
    retryCountIncrement?: boolean;
    startedAt?: Date | null;
    finishedAt?: Date | null;
  },
  db: DbClient = prisma,
) {
  return db.taskRun.update({
    where: { id },
    data: {
      status: data.status,
      result: data.result,
      errorMessage: data.errorMessage,
      startedAt: data.startedAt,
      finishedAt: data.finishedAt,
      ...(data.retryCountIncrement ? { retryCount: { increment: 1 } } : {}),
    },
  });
}

export async function runTask<T>(
  input: TaskRunInput,
  runner: (taskId: string) => Promise<T>,
) {
  const task = await createTaskRun(input);
  await updateTaskRun(task.id, {
    status: "RUNNING",
    startedAt: new Date(),
  });

  try {
    const result = await runner(task.id);
    await updateTaskRun(task.id, {
      status: "SUCCESS",
      finishedAt: new Date(),
      result: result as Prisma.InputJsonValue,
      errorMessage: null,
    });
    return { taskId: task.id, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "任务失败";
    await updateTaskRun(task.id, {
      status: "FAILED",
      finishedAt: new Date(),
      errorMessage: message,
    });
    throw error;
  }
}

export async function recordTaskFailure(
  input: TaskRunInput & {
    errorMessage: string;
  },
  db: DbClient = prisma,
) {
  return db.taskRun.create({
    data: {
      kind: input.kind,
      title: input.title,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      payload: input.payload,
      retryable: input.retryable ?? false,
      triggeredById: input.triggeredById ?? null,
      status: "FAILED",
      errorMessage: input.errorMessage,
      finishedAt: new Date(),
    },
  });
}

