import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { isIP } from "node:net";
import { Reader, type CityResponse, type CountryResponse } from "maxmind";

type HeaderReader = Pick<Headers, "get">;
type GeoIpResponse = CityResponse | CountryResponse;


let geoIpReader: Reader<GeoIpResponse> | null | undefined;

export interface RequestGeoContext {
  country: string | null;
  region: string | null;
  regionCode: string | null;
  city: string | null;
  latitude: string | null;
  longitude: string | null;
  source: string | null;
}

export interface ClientRequestContext {
  ip: string;
  userAgent: string | null;
  geo: RequestGeoContext;
}

function emptyGeoContext(source: string | null = null): RequestGeoContext {
  return {
    country: null,
    region: null,
    regionCode: null,
    city: null,
    latitude: null,
    longitude: null,
    source,
  };
}

function hasGeoValue(geo: RequestGeoContext) {
  return Boolean(geo.country || geo.region || geo.regionCode || geo.city || geo.latitude || geo.longitude);
}

function resolveGeoIpDatabasePath() {
  const configured = process.env.GEOIP_MMDB_PATH?.trim();
  if (!configured) {
    return path.join(process.cwd(), "data", "GeoLite2-City.mmdb");
  }

  return path.isAbsolute(configured)
    ? configured
    : path.join(/* turbopackIgnore: true */ process.cwd(), configured);
}

function getGeoIpReader() {
  if (geoIpReader !== undefined) return geoIpReader;

  const databasePath = resolveGeoIpDatabasePath();
  if (!existsSync(/* turbopackIgnore: true */ databasePath)) {
    geoIpReader = null;
    return geoIpReader;
  }

  try {
    geoIpReader = new Reader<GeoIpResponse>(readFileSync(/* turbopackIgnore: true */ databasePath));
  } catch (error) {
    geoIpReader = null;
    if (process.env.NODE_ENV !== "production") {
      console.warn("Failed to load GeoIP MMDB database:", error);
    }
  }

  return geoIpReader;
}

function localizedName(record: { names?: object } | null | undefined) {
  if (!record?.names) return null;
  const names = record.names as { "zh-CN"?: string; en?: string };
  return names["zh-CN"] ?? names.en ?? Object.values(names).find((value) => typeof value === "string") ?? null;
}

export function getIpGeoContext(ip: string): RequestGeoContext {
  if (ip === "unknown" || !isIP(ip)) return emptyGeoContext();

  const reader = getGeoIpReader();
  if (!reader) return emptyGeoContext();

  const record = reader.get(ip);
  if (!record) return emptyGeoContext();

  const country = record.country ?? record.registered_country ?? null;
  const cityRecord = "city" in record ? record.city : null;
  const subdivision = "subdivisions" in record ? record.subdivisions?.[0] : null;
  const location = "location" in record ? record.location : null;

  const geo = {
    country: country?.iso_code ?? localizedName(country),
    region: localizedName(subdivision),
    regionCode: subdivision?.iso_code ?? null,
    city: localizedName(cityRecord),
    latitude: location?.latitude == null ? null : String(location.latitude),
    longitude: location?.longitude == null ? null : String(location.longitude),
    source: "mmdb",
  } satisfies RequestGeoContext;

  return hasGeoValue(geo) ? geo : emptyGeoContext();
}

function sameCountry(headerGeo: RequestGeoContext, mmdbGeo: RequestGeoContext) {
  if (!headerGeo.country || !mmdbGeo.country) return true;
  return headerGeo.country.trim().toLowerCase() === mmdbGeo.country.trim().toLowerCase();
}

function mergeGeoContext(headerGeo: RequestGeoContext, mmdbGeo: RequestGeoContext): RequestGeoContext {
  const useMmdb = sameCountry(headerGeo, mmdbGeo);
  const merged: RequestGeoContext = {
    country: headerGeo.country ?? (useMmdb ? mmdbGeo.country : null),
    region: headerGeo.region ?? (useMmdb ? mmdbGeo.region : null),
    regionCode: headerGeo.regionCode ?? (useMmdb ? mmdbGeo.regionCode : null),
    city: headerGeo.city ?? (useMmdb ? mmdbGeo.city : null),
    latitude: headerGeo.latitude ?? (useMmdb ? mmdbGeo.latitude : null),
    longitude: headerGeo.longitude ?? (useMmdb ? mmdbGeo.longitude : null),
    source: null,
  };

  const sources = new Set<string>();
  if (hasGeoValue(headerGeo) && headerGeo.source) sources.add(headerGeo.source);
  if (useMmdb && hasGeoValue(mmdbGeo)) sources.add("mmdb");
  merged.source = sources.size > 0 ? Array.from(sources).join("+") : null;

  return merged;
}

function firstHeader(headers: HeaderReader, names: string[]) {
  for (const name of names) {
    const value = headers.get(name)?.split(",")[0]?.trim();
    if (value) return value;
  }
  return null;
}

function decodeHeaderValue(value: string | null) {
  if (!value) return null;
  const normalized = value.trim();
  if (!normalized || normalized.toLowerCase() === "unknown") return null;

  try {
    return decodeURIComponent(normalized.replace(/\+/g, "%20"));
  } catch {
    return normalized;
  }
}

function stripPort(value: string) {
  const trimmed = value.trim().replace(/^"|"$/g, "");
  if (trimmed.startsWith("[") && trimmed.includes("]")) {
    return trimmed.slice(1, trimmed.indexOf("]"));
  }

  if (isIP(trimmed)) return trimmed;

  const ipv4WithPort = trimmed.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
  if (ipv4WithPort) return ipv4WithPort[1];

  return trimmed;
}

function normalizeIp(value: string | null) {
  if (!value) return null;
  const candidate = stripPort(value);
  if (candidate.startsWith("::ffff:")) {
    const ipv4 = candidate.slice(7);
    return isIP(ipv4) ? ipv4 : null;
  }

  return isIP(candidate) ? candidate : null;
}

export function getClientIp(headers: HeaderReader) {
  const direct = firstHeader(headers, [
    "cf-connecting-ip",
    "true-client-ip",
    "x-real-ip",
    "x-client-ip",
  ]);
  const normalizedDirect = normalizeIp(direct);
  if (normalizedDirect) return normalizedDirect;

  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    for (const item of forwarded.split(",")) {
      const normalized = normalizeIp(item);
      if (normalized) return normalized;
    }
  }

  return "unknown";
}

export function getRequestGeo(headers: HeaderReader, ip = "unknown"): RequestGeoContext {
  const country = decodeHeaderValue(firstHeader(headers, [
    "cf-ipcountry",
    "x-vercel-ip-country",
    "x-geo-country",
    "cloudfront-viewer-country",
  ]));
  const region = decodeHeaderValue(firstHeader(headers, [
    "cf-ipregion",
    "cf-region",
    "x-vercel-ip-country-region",
    "x-geo-region",
    "x-real-ip-region",
    "x-real-ip-province",
  ]));
  const regionCode = decodeHeaderValue(firstHeader(headers, [
    "cf-ipregion-code",
    "cf-region-code",
    "x-vercel-ip-country-region",
    "x-geo-region-code",
  ]));
  const city = decodeHeaderValue(firstHeader(headers, [
    "cf-ipcity",
    "cf-city",
    "x-vercel-ip-city",
    "x-geo-city",
    "x-real-ip-city",
  ]));
  const latitude = decodeHeaderValue(firstHeader(headers, [
    "cf-iplatitude",
    "x-geo-latitude",
  ]));
  const longitude = decodeHeaderValue(firstHeader(headers, [
    "cf-iplongitude",
    "x-geo-longitude",
  ]));

  let source: string | null = null;
  if (headers.get("cf-connecting-ip") || headers.get("cf-ipcountry")) {
    source = "cloudflare";
  } else if (headers.get("x-vercel-ip-country")) {
    source = "vercel";
  } else if (country || region || city) {
    source = "proxy";
  }

  const headerGeo = { country, region, regionCode, city, latitude, longitude, source };
  return mergeGeoContext(headerGeo, getIpGeoContext(ip));
}

export function getClientRequestContext(headers: HeaderReader): ClientRequestContext {
  const ip = getClientIp(headers);
  return {
    ip,
    userAgent: headers.get("user-agent")?.slice(0, 500) ?? null,
    geo: getRequestGeo(headers, ip),
  };
}
