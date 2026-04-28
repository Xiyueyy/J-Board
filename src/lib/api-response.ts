import { NextResponse } from "next/server";
import { getErrorMessage } from "./errors";

export function jsonError(
  error: unknown,
  options?: {
    status?: number;
    fallback?: string;
    headers?: HeadersInit;
  },
) {
  return NextResponse.json(
    {
      error: getErrorMessage(error, options?.fallback ?? "请求失败"),
    },
    {
      status: options?.status ?? 500,
      headers: options?.headers,
    },
  );
}

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}
