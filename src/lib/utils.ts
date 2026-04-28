import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from "date-fns"
import { zhCN } from "date-fns/locale"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBytes(bytes: number | bigint): string {
  const b = Number(bytes);
  if (b === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return `${(b / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

export function gbToBytes(gb: number): bigint {
  return BigInt(Math.round(gb * 1024 * 1024 * 1024));
}

export function bytesToGb(bytes: bigint): number {
  return Number(bytes) / (1024 * 1024 * 1024);
}

export function formatDate(date: Date | string): string {
  return format(new Date(date), "yyyy-MM-dd HH:mm", { locale: zhCN });
}

export function formatDateShort(date: Date | string): string {
  return format(new Date(date), "yyyy-MM-dd", { locale: zhCN });
}

export function parsePage(searchParams: Record<string, string | string[] | undefined>, pageSize = 20) {
  const raw = searchParams.page;
  const page = Math.max(1, parseInt(typeof raw === "string" ? raw : "1", 10) || 1);
  const skip = (page - 1) * pageSize;
  return { page, skip, pageSize };
}
