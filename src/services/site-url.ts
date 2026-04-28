import { prisma, type DbClient } from "@/lib/prisma";
import { getAppConfig } from "@/services/app-config";

function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function isLocalHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export function normalizeSiteUrl(raw: string | null | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;

  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    throw new Error("站点域名格式不正确，请填写 https://example.com");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("站点域名仅支持 http:// 或 https://");
  }
  if (!url.hostname) {
    throw new Error("站点域名不能为空");
  }

  url.search = "";
  url.hash = "";
  return stripTrailingSlash(`${url.origin}${url.pathname === "/" ? "" : url.pathname}`);
}

function safeNormalizeSiteUrl(raw: string | null | undefined): string | null {
  try {
    return normalizeSiteUrl(raw);
  } catch {
    return null;
  }
}

function getHeaderValue(headers: Headers, name: string) {
  return headers.get(name)?.split(",")[0]?.trim() || null;
}

export function getForwardedSiteUrl(headers: Headers): string | null {
  const host = getHeaderValue(headers, "x-forwarded-host") ?? getHeaderValue(headers, "host");
  if (!host) return null;

  const proto = getHeaderValue(headers, "x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const normalized = safeNormalizeSiteUrl(`${proto}://${host}`);
  if (!normalized) return null;

  try {
    const url = new URL(normalized);
    if (isLocalHost(url.hostname)) return null;
  } catch {
    return null;
  }

  return normalized;
}

export function getRequestOriginUrl(requestUrl: string | null | undefined): string | null {
  if (!requestUrl) return null;
  try {
    const url = new URL(requestUrl);
    if (isLocalHost(url.hostname)) return null;
    return safeNormalizeSiteUrl(url.origin);
  } catch {
    return null;
  }
}

export async function getConfiguredSiteUrl(db: DbClient = prisma): Promise<string | null> {
  const config = await getAppConfig(db);
  return safeNormalizeSiteUrl(config.siteUrl) ?? safeNormalizeSiteUrl(process.env.NEXTAUTH_URL);
}

export async function getSiteBaseUrl(options: {
  headers?: Headers;
  requestUrl?: string;
  db?: DbClient;
  allowRequestFallback?: boolean;
} = {}): Promise<string> {
  const configured = await getConfiguredSiteUrl(options.db ?? prisma);
  if (configured) return configured;
  if (!options.allowRequestFallback) return "";

  return (
    options.headers ? getForwardedSiteUrl(options.headers) : null
  ) ?? getRequestOriginUrl(options.requestUrl) ?? "";
}
