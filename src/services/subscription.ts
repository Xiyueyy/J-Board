import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import type { Protocol } from "@prisma/client";

type JsonRecord = Record<string, unknown>;

interface PanelClient {
  id?: string;
  password?: string;
  auth?: string;
  email?: string;
  flow?: string;
  security?: string;
  method?: string;
}

export interface ProxyNodeContext {
  email?: string;
  uuid: string;
  inbound: {
    protocol: Protocol;
    port: number;
    tag: string;
    settings: unknown;
    streamSettings: unknown;
    server: {
      name: string;
      panelUrl: string | null;
    };
  };
}

interface LinkTarget {
  address: string;
  port: number;
  securityOverride?: string;
  remark?: string;
}

export type SubscriptionOutputFormat = "base64" | "uri" | "clash";

export interface SubscriptionTrafficStats {
  upload?: bigint | number | null;
  download?: bigint | number | null;
  total?: bigint | number | null;
  expire?: Date | null;
}

const CLASH_FORMAT_ALIASES = new Set(["clash", "clash-meta", "mihomo", "yaml", "yml"]);
const URI_FORMAT_ALIASES = new Set(["uri", "raw", "plain", "text"]);
const BASE64_FORMAT_ALIASES = new Set(["base64", "v2ray", "generic"]);

function normalizeSubscriptionFormat(raw: string | null): SubscriptionOutputFormat | null {
  if (!raw) return null;
  const normalized = raw.trim().toLowerCase();
  if (CLASH_FORMAT_ALIASES.has(normalized)) return "clash";
  if (URI_FORMAT_ALIASES.has(normalized)) return "uri";
  if (BASE64_FORMAT_ALIASES.has(normalized)) return "base64";
  return null;
}

function isClashLikeUserAgent(userAgent: string | null | undefined) {
  if (!userAgent) return false;
  return /clash|mihomo|verge|stash|flclash|nyanpasu|openclash/i.test(userAgent);
}

export function resolveSubscriptionFormat(
  searchParams: URLSearchParams,
  userAgent?: string | null,
): SubscriptionOutputFormat {
  return normalizeSubscriptionFormat(searchParams.get("format") ?? searchParams.get("target"))
    ?? (isClashLikeUserAgent(userAgent) ? "clash" : "base64");
}

export function getSubscriptionContentType(format: SubscriptionOutputFormat) {
  return format === "clash" ? "text/yaml; charset=utf-8" : "text/plain; charset=utf-8";
}

export function getSubscriptionFilename(baseName: string, format: SubscriptionOutputFormat) {
  return `${baseName}.${format === "clash" ? "yaml" : "txt"}`;
}

function bigintHeaderValue(value: bigint | number | null | undefined) {
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.floor(value)).toString();
  return "0";
}

export function buildSubscriptionUserInfo(stats: SubscriptionTrafficStats | null | undefined) {
  if (!stats) return null;
  const expire = stats.expire ? Math.floor(stats.expire.getTime() / 1000) : 0;
  return [
    `upload=${bigintHeaderValue(stats.upload)}`,
    `download=${bigintHeaderValue(stats.download)}`,
    `total=${bigintHeaderValue(stats.total)}`,
    `expire=${expire}`,
  ].join("; ");
}

function getAggregateSubscriptionSecret() {
  const secret = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("缺少订阅链接签名密钥，请配置 NEXTAUTH_SECRET 或 AUTH_SECRET");
  }
  return secret;
}

export function getAggregateSubscriptionToken(userId: string): string {
  return createHmac("sha256", getAggregateSubscriptionSecret())
    .update(`aggregate-subscription:${userId}`)
    .digest("base64url");
}

export function verifyAggregateSubscriptionToken(userId: string, token: string): boolean {
  const expected = getAggregateSubscriptionToken(userId);
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(token));
  } catch {
    return false;
  }
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.length > 0);
  }
  if (typeof value === "string" && value.length > 0) {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function firstString(value: unknown): string | null {
  return stringList(value)[0] ?? asString(value);
}

function getDeep(value: unknown, key: string): unknown {
  const record = asRecord(value);
  if (record) {
    if (key in record) return record[key];
    for (const child of Object.values(record)) {
      const result = getDeep(child, key);
      if (result !== undefined) return result;
    }
  }

  for (const child of asArray(value)) {
    const result = getDeep(child, key);
    if (result !== undefined) return result;
  }

  return undefined;
}

function addParam(params: URLSearchParams, key: string, value: unknown) {
  const normalized = typeof value === "number" ? String(value) : asString(value);
  if (normalized) params.set(key, normalized);
}

function addParamList(params: URLSearchParams, key: string, value: unknown) {
  const values = stringList(value);
  if (values.length > 0) params.set(key, values.join(","));
}

function getDisplayName(nodeClient: ProxyNodeContext, target?: LinkTarget): string {
  const settings = asRecord(nodeClient.inbound.settings);
  const base = asString(settings?.displayName) ?? `${nodeClient.inbound.server.name}-${nodeClient.inbound.tag}`;
  return target?.remark ? `${base}-${target.remark}` : base;
}

function isWildcardListen(value: string | null) {
  return !value || value === "0.0.0.0" || value === "::" || value === "::0";
}

function getSettings(nodeClient: ProxyNodeContext): JsonRecord {
  return asRecord(nodeClient.inbound.settings) ?? {};
}

function getStream(nodeClient: ProxyNodeContext): JsonRecord {
  return asRecord(nodeClient.inbound.streamSettings) ?? {};
}

function getPanelListen(settings: JsonRecord): string | null {
  const meta = asRecord(settings._jboard);
  return asString(meta?.listen) ?? null;
}

function getServerAddress(nodeClient: ProxyNodeContext): string {
  const settings = getSettings(nodeClient);
  const listen = getPanelListen(settings);
  if (!isWildcardListen(listen)) return listen!;

  const server = nodeClient.inbound.server;
  if (!server.panelUrl) return server.name;
  try {
    const withProtocol = /^https?:\/\//i.test(server.panelUrl)
      ? server.panelUrl
      : `http://${server.panelUrl}`;
    return new URL(withProtocol).hostname || server.name;
  } catch {
    return server.name;
  }
}

function formatHost(host: string) {
  if (host.includes(":") && !host.startsWith("[")) return `[${host}]`;
  return host;
}

function getClients(settings: JsonRecord): PanelClient[] {
  return asArray(settings.clients)
    .map((item) => asRecord(item) as PanelClient | null)
    .filter((item): item is PanelClient => item != null);
}

function findClient(nodeClient: ProxyNodeContext): PanelClient | null {
  const settings = getSettings(nodeClient);
  return getClients(settings).find((client) => {
    return client.email === nodeClient.email
      || client.id === nodeClient.uuid
      || client.password === nodeClient.uuid
      || client.auth === nodeClient.uuid;
  }) ?? null;
}

function firstClientValue(settings: JsonRecord, key: keyof PanelClient): string | null {
  for (const client of getClients(settings)) {
    const value = asString(client[key]);
    if (value) return value;
  }
  return null;
}

function getHeaderValue(headers: unknown, headerName: string): string | null {
  const record = asRecord(headers);
  if (!record) return null;

  const matchedKey = Object.keys(record).find((key) => key.toLowerCase() === headerName.toLowerCase());
  return matchedKey ? firstString(record[matchedKey]) : null;
}

function applyPathAndHost(settings: unknown, params: URLSearchParams) {
  const record = asRecord(settings);
  if (!record) return;

  addParam(params, "path", record.path);
  addParam(params, "host", asString(record.host) ?? getHeaderValue(record.headers, "host"));
}

function applyPathAndHostObj(settings: unknown, obj: JsonRecord) {
  const record = asRecord(settings);
  if (!record) return;

  const path = asString(record.path);
  const host = asString(record.host) ?? getHeaderValue(record.headers, "host");
  if (path) obj.path = path;
  if (host) obj.host = host;
}

function applyTcpParams(stream: JsonRecord, params: URLSearchParams) {
  const tcp = asRecord(stream.tcpSettings);
  const header = asRecord(tcp?.header);
  if (!header || asString(header.type) !== "http") return;

  const request = asRecord(header.request);
  addParam(params, "path", firstString(request?.path));
  addParam(params, "host", getHeaderValue(request?.headers, "host"));
  params.set("headerType", "http");
}

function applyTcpObj(stream: JsonRecord, obj: JsonRecord) {
  const tcp = asRecord(stream.tcpSettings);
  const header = asRecord(tcp?.header);
  const type = asString(header?.type) ?? "none";
  obj.type = type;
  if (!header || type !== "http") return;

  const request = asRecord(header.request);
  const path = firstString(request?.path);
  const host = getHeaderValue(request?.headers, "host");
  if (path) obj.path = path;
  if (host) obj.host = host;
}

function applyKcpParams(stream: JsonRecord, params: URLSearchParams) {
  const kcp = asRecord(stream.kcpSettings);
  const header = asRecord(kcp?.header);
  addParam(params, "headerType", header?.type);
  addParam(params, "seed", kcp?.seed);
  addParam(params, "mtu", asNumber(kcp?.mtu));
  addParam(params, "tti", asNumber(kcp?.tti));
}

function applyKcpObj(stream: JsonRecord, obj: JsonRecord) {
  const kcp = asRecord(stream.kcpSettings);
  const header = asRecord(kcp?.header);
  const headerType = asString(header?.type);
  const seed = asString(kcp?.seed);
  if (headerType && headerType !== "none") obj.type = headerType;
  if (seed) obj.path = seed;
  const mtu = asNumber(kcp?.mtu);
  const tti = asNumber(kcp?.tti);
  if (mtu) obj.mtu = mtu;
  if (tti) obj.tti = tti;
}

function applyGrpcParams(stream: JsonRecord, params: URLSearchParams) {
  const grpc = asRecord(stream.grpcSettings);
  if (!grpc) return;
  addParam(params, "serviceName", grpc.serviceName);
  addParam(params, "authority", grpc.authority);
  if (asBoolean(grpc.multiMode)) params.set("mode", "multi");
}

function applyGrpcObj(stream: JsonRecord, obj: JsonRecord) {
  const grpc = asRecord(stream.grpcSettings);
  if (!grpc) return;
  const serviceName = asString(grpc.serviceName);
  const authority = asString(grpc.authority);
  if (serviceName) obj.path = serviceName;
  if (authority) obj.authority = authority;
  if (asBoolean(grpc.multiMode)) obj.type = "multi";
}

function applyNetworkParams(stream: JsonRecord, network: string, params: URLSearchParams) {
  switch (network) {
    case "tcp":
      applyTcpParams(stream, params);
      break;
    case "kcp":
      applyKcpParams(stream, params);
      break;
    case "ws":
      applyPathAndHost(stream.wsSettings, params);
      break;
    case "grpc":
      applyGrpcParams(stream, params);
      break;
    case "httpupgrade":
      applyPathAndHost(stream.httpupgradeSettings, params);
      break;
    case "xhttp": {
      const xhttp = asRecord(stream.xhttpSettings);
      applyPathAndHost(xhttp, params);
      addParam(params, "mode", xhttp?.mode);
      break;
    }
  }
}

function applyNetworkObj(stream: JsonRecord, network: string, obj: JsonRecord) {
  obj.net = network;
  switch (network) {
    case "tcp":
      applyTcpObj(stream, obj);
      break;
    case "kcp":
      applyKcpObj(stream, obj);
      break;
    case "ws":
      applyPathAndHostObj(stream.wsSettings, obj);
      break;
    case "grpc":
      applyGrpcObj(stream, obj);
      break;
    case "httpupgrade":
      applyPathAndHostObj(stream.httpupgradeSettings, obj);
      break;
    case "xhttp": {
      const xhttp = asRecord(stream.xhttpSettings);
      applyPathAndHostObj(xhttp, obj);
      const mode = asString(xhttp?.mode);
      if (mode) obj.type = mode;
      break;
    }
    default:
      obj.type = "none";
  }
}

function hasJsonContent(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasJsonContent);
  const record = asRecord(value);
  if (record) return Object.values(record).some(hasJsonContent);
  if (typeof value === "string") return value.length > 0;
  return typeof value === "number" || value === true;
}

function applyFinalMaskParams(stream: JsonRecord, params: URLSearchParams) {
  const finalmask = asRecord(stream.finalmask);
  if (!finalmask || !hasJsonContent(finalmask)) return;
  params.set("fm", JSON.stringify(finalmask));
}

function applyFinalMaskObj(stream: JsonRecord, obj: JsonRecord) {
  const finalmask = asRecord(stream.finalmask);
  if (!finalmask || !hasJsonContent(finalmask)) return;
  obj.fm = JSON.stringify(finalmask);
}

function applyTlsParams(stream: JsonRecord, params: URLSearchParams, includeInsecure = false) {
  params.set("security", "tls");
  const tls = asRecord(stream.tlsSettings);
  const nested = asRecord(tls?.settings);
  addParamList(params, "alpn", tls?.alpn);
  addParam(params, "sni", tls?.serverName ?? nested?.serverName);
  addParam(params, "fp", nested?.fingerprint ?? tls?.fingerprint);
  addParam(params, "ech", nested?.echConfigList ?? tls?.echConfigList);
  if (includeInsecure && (asBoolean(nested?.allowInsecure) || asBoolean(tls?.allowInsecure))) {
    params.set("insecure", "1");
  }
}

function applyTlsObj(stream: JsonRecord, obj: JsonRecord) {
  const tls = asRecord(stream.tlsSettings);
  const nested = asRecord(tls?.settings);
  const alpn = stringList(tls?.alpn);
  const sni = asString(tls?.serverName) ?? asString(nested?.serverName);
  const fp = asString(nested?.fingerprint) ?? asString(tls?.fingerprint);
  if (alpn.length > 0) obj.alpn = alpn.join(",");
  if (sni) obj.sni = sni;
  if (fp) obj.fp = fp;
}

function applyRealityParams(stream: JsonRecord, params: URLSearchParams) {
  params.set("security", "reality");
  const reality = asRecord(stream.realitySettings);
  const nested = asRecord(reality?.settings);
  addParam(params, "sni", firstString(reality?.serverNames) ?? reality?.serverName);
  addParam(params, "pbk", nested?.publicKey ?? reality?.publicKey);
  addParam(params, "sid", firstString(reality?.shortIds) ?? reality?.shortId);
  addParam(params, "fp", nested?.fingerprint ?? reality?.fingerprint);
  addParam(params, "spx", nested?.spiderX ?? reality?.spiderX);
  addParam(params, "pqv", nested?.mldsa65Verify ?? reality?.mldsa65Verify);
}

function buildStreamParams(
  stream: JsonRecord,
  options: {
    settings?: JsonRecord;
    includeEncryption?: boolean;
    includeSecurityNone?: boolean;
    includeInsecure?: boolean;
    flow?: string | null;
    securityOverride?: string;
  } = {},
): URLSearchParams {
  const params = new URLSearchParams();
  const network = asString(stream.network) ?? "tcp";
  const security = options.securityOverride && options.securityOverride !== "same"
    ? options.securityOverride
    : (asString(stream.security) ?? "none");

  params.set("type", network);
  if (options.includeEncryption) {
    params.set("encryption", asString(options.settings?.encryption) ?? "none");
  }

  applyNetworkParams(stream, network, params);
  applyFinalMaskParams(stream, params);

  if (security === "tls") {
    applyTlsParams(stream, params, options.includeInsecure);
  } else if (security === "reality") {
    applyRealityParams(stream, params);
  } else if (options.includeSecurityNone) {
    params.set("security", "none");
  }

  if ((security === "tls" || security === "reality") && network === "tcp" && options.flow) {
    params.set("flow", options.flow);
  }

  return params;
}

function appendQueryAndHash(base: string, params: URLSearchParams, label: string) {
  const query = params.toString();
  return `${base}${query ? `?${query}` : ""}#${encodeURIComponent(label)}`;
}

function stripUndefined<T extends JsonRecord>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== "")) as T;
}

function yamlQuote(value: string) {
  return JSON.stringify(value);
}

function toYaml(value: unknown, indent = 0): string {
  const pad = " ".repeat(indent);
  if (Array.isArray(value)) {
    if (value.length === 0) return `${pad}[]`;
    return value.map((item) => {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        const record = item as JsonRecord;
        const entries = Object.entries(record);
        if (entries.length === 0) return `${pad}- {}`;
        const [firstKey, firstValue] = entries[0];
        const firstLine = `${pad}- ${firstKey}: ${yamlInline(firstValue)}`;
        const rest = entries.slice(1).map(([key, child]) => `${pad}  ${key}: ${yamlBlock(child, indent + 2)}`);
        return [firstLine, ...rest].join("\n");
      }
      return `${pad}- ${yamlInline(item)}`;
    }).join("\n");
  }

  const record = asRecord(value);
  if (!record) return `${pad}${yamlInline(value)}`;
  const entries = Object.entries(record);
  if (entries.length === 0) return `${pad}{}`;
  return entries.map(([key, child]) => `${pad}${key}: ${yamlBlock(child, indent)}`).join("\n");
}

function yamlBlock(value: unknown, indent: number) {
  if (value && typeof value === "object") {
    const nested = toYaml(value, indent + 2);
    return `\n${nested}`;
  }
  return yamlInline(value);
}

function yamlInline(value: unknown): string {
  if (typeof value === "string") return yamlQuote(value);
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value == null) return "null";
  return yamlQuote(String(value));
}

function getTargets(nodeClient: ProxyNodeContext): LinkTarget[] {
  const stream = getStream(nodeClient);
  const proxies: LinkTarget[] = [];

  for (const item of asArray(stream.externalProxy)) {
    const record = asRecord(item);
    if (!record) continue;

    const address = asString(record.dest);
    const port = asNumber(record.port);
    if (!address || !port) continue;

    const securityOverride = asString(record.forceTls);
    const remark = asString(record.remark);
    proxies.push({
      address,
      port,
      ...(securityOverride ? { securityOverride } : {}),
      ...(remark ? { remark } : {}),
    });
  }

  if (proxies.length > 0) return proxies;
  return [{ address: getServerAddress(nodeClient), port: nodeClient.inbound.port }];
}

function getStreamSecurity(stream: JsonRecord, target?: LinkTarget) {
  return target?.securityOverride && target.securityOverride !== "same"
    ? target.securityOverride
    : (asString(stream.security) ?? "none");
}

function getTlsSettings(stream: JsonRecord) {
  const tls = asRecord(stream.tlsSettings);
  const nested = asRecord(tls?.settings);
  return { tls, nested };
}

function getRealitySettings(stream: JsonRecord) {
  const reality = asRecord(stream.realitySettings);
  const nested = asRecord(reality?.settings);
  return { reality, nested };
}

function applyClashTls(proxy: JsonRecord, stream: JsonRecord, security: string) {
  if (security !== "tls" && security !== "reality") return;

  proxy.tls = true;
  if (security === "tls") {
    const { tls, nested } = getTlsSettings(stream);
    const serverName = asString(tls?.serverName) ?? asString(nested?.serverName);
    const fingerprint = asString(nested?.fingerprint) ?? asString(tls?.fingerprint);
    const alpn = stringList(tls?.alpn);
    if (serverName) proxy.servername = serverName;
    if (fingerprint) proxy["client-fingerprint"] = fingerprint;
    if (alpn.length > 0) proxy.alpn = alpn;
    if (asBoolean(nested?.allowInsecure) || asBoolean(tls?.allowInsecure)) {
      proxy["skip-cert-verify"] = true;
    }
    return;
  }

  const { reality, nested } = getRealitySettings(stream);
  const serverName = firstString(reality?.serverNames) ?? asString(reality?.serverName);
  const publicKey = asString(nested?.publicKey) ?? asString(reality?.publicKey);
  const shortId = firstString(reality?.shortIds) ?? asString(reality?.shortId);
  const fingerprint = asString(nested?.fingerprint) ?? asString(reality?.fingerprint);
  const spiderX = asString(nested?.spiderX) ?? asString(reality?.spiderX);
  if (serverName) proxy.servername = serverName;
  if (fingerprint) proxy["client-fingerprint"] = fingerprint;
  proxy["reality-opts"] = stripUndefined({
    "public-key": publicKey,
    "short-id": shortId,
    "spider-x": spiderX,
  });
}

function getPathAndHost(settings: unknown) {
  const record = asRecord(settings);
  if (!record) return { path: null, host: null };
  return {
    path: asString(record.path),
    host: asString(record.host) ?? getHeaderValue(record.headers, "host"),
  };
}

function applyClashTransport(proxy: JsonRecord, stream: JsonRecord) {
  const network = asString(stream.network) ?? "tcp";
  if (network === "tcp") {
    const tcp = asRecord(stream.tcpSettings);
    const header = asRecord(tcp?.header);
    if (asString(header?.type) !== "http") return;
    const request = asRecord(header?.request);
    proxy.network = "http";
    proxy["http-opts"] = stripUndefined({
      path: stringList(request?.path),
      headers: stripUndefined({ Host: stringList(asRecord(request?.headers)?.Host ?? asRecord(request?.headers)?.host) }),
    });
    return;
  }

  proxy.network = network;
  if (network === "ws") {
    const { path, host } = getPathAndHost(stream.wsSettings);
    proxy["ws-opts"] = stripUndefined({
      path,
      headers: host ? { Host: host } : undefined,
    });
  } else if (network === "grpc") {
    const grpc = asRecord(stream.grpcSettings);
    proxy["grpc-opts"] = stripUndefined({
      "grpc-service-name": asString(grpc?.serviceName),
    });
  } else if (network === "httpupgrade") {
    const { path, host } = getPathAndHost(stream.httpupgradeSettings);
    proxy["httpupgrade-opts"] = stripUndefined({
      path,
      headers: host ? { Host: host } : undefined,
    });
  } else if (network === "xhttp") {
    const { path, host } = getPathAndHost(stream.xhttpSettings);
    proxy["xhttp-opts"] = stripUndefined({
      path,
      headers: host ? { Host: host } : undefined,
    });
  }
}

function buildClashProxy(nodeClient: ProxyNodeContext, target: LinkTarget, client: PanelClient | null) {
  const protocol = nodeClient.inbound.protocol.toLowerCase();
  const stream = getStream(nodeClient);
  const settings = getSettings(nodeClient);
  const security = getStreamSecurity(stream, target);
  const base: JsonRecord = {
    name: getDisplayName(nodeClient, target),
    server: target.address,
    port: target.port,
    udp: true,
  };

  let proxy: JsonRecord | null = null;
  if (protocol === "vmess") {
    proxy = {
      ...base,
      type: "vmess",
      uuid: asString(client?.id) ?? nodeClient.uuid,
      alterId: asNumber(settings.alterId) ?? 0,
      cipher: getVmessSecurity(settings, client),
    };
  } else if (protocol === "vless") {
    proxy = stripUndefined({
      ...base,
      type: "vless",
      uuid: asString(client?.id) ?? nodeClient.uuid,
      flow: getVlessFlow(settings, client),
    });
  } else if (protocol === "trojan") {
    proxy = {
      ...base,
      type: "trojan",
      password: asString(client?.password) ?? nodeClient.uuid,
    };
  } else if (protocol === "shadowsocks") {
    const method = asString(settings.method) ?? asString(client?.method) ?? "chacha20-ietf-poly1305";
    const inboundPassword = asString(settings.password) ?? asString(settings.serverKey);
    const clientPassword = asString(client?.password) ?? nodeClient.uuid;
    proxy = {
      ...base,
      type: "ss",
      cipher: method,
      password: method.startsWith("2022-") && inboundPassword ? `${inboundPassword}:${clientPassword}` : clientPassword,
    };
  } else if (protocol === "hysteria2") {
    const obfsPassword = findSalamanderPassword(stream);
    proxy = stripUndefined({
      ...base,
      type: asNumber(settings.version) === 1 ? "hysteria" : "hysteria2",
      password: asString(client?.auth) ?? nodeClient.uuid,
      obfs: obfsPassword ? "salamander" : undefined,
      "obfs-password": obfsPassword,
    });
  }

  if (!proxy) return null;
  applyClashTransport(proxy, stream);
  applyClashTls(proxy, stream, security);
  return stripUndefined(proxy);
}

function dedupeProxyNames(proxies: JsonRecord[]) {
  const seen = new Map<string, number>();
  return proxies.map((proxy) => {
    const name = asString(proxy.name) ?? "J-Board";
    const count = seen.get(name) ?? 0;
    seen.set(name, count + 1);
    return count === 0 ? proxy : { ...proxy, name: `${name} ${count + 1}` };
  });
}

const MIHOMO_PROXY_NAME_FALLBACK = ["DIRECT"];

const MIHOMO_SUBSCRIPTION_TEMPLATE = String.raw`mixed-port: 7897
allow-lan: true
mode: rule
log-level: info
unified-delay: true
tcp-concurrent: true
find-process-mode: strict

dns:
  enable: true
  listen: "127.0.0.1:5335"
  use-system-hosts: false
  enhanced-mode: fake-ip
  fake-ip-range: 198.18.0.1/16
  default-nameserver:
    - 180.76.76.76
    - 182.254.118.118
    - 8.8.8.8
    - 180.184.2.2
  nameserver:
    - 180.76.76.76
    - 119.29.29.29
    - 180.184.1.1
    - 223.5.5.5
    - 8.8.8.8
    - "https://223.6.6.6/dns-query#h3=true"
    - "https://dns.alidns.com/dns-query"
    - "https://cloudflare-dns.com/dns-query"
    - "https://doh.pub/dns-query"
  fallback:
    - "https://000000.dns.nextdns.io/dns-query#h3=true"
    - "https://dns.alidns.com/dns-query"
    - "https://doh.pub/dns-query"
    - "https://public.dns.iij.jp/dns-query"
    - "https://101.101.101.101/dns-query"
    - "https://208.67.220.220/dns-query"
    - "tls://8.8.4.4"
    - "tls://1.0.0.1:853"
    - "https://cloudflare-dns.com/dns-query"
    - "https://dns.google/dns-query"
  fallback-filter:
    geoip: true
    ipcidr:
      - 240.0.0.0/4
      - 0.0.0.0/32
      - 127.0.0.1/32
    domain:
      - "+.google.com"
      - "+.facebook.com"
      - "+.twitter.com"
      - "+.youtube.com"
      - "+.xn--ngstr-lra8j.com"
      - "+.google.cn"
      - "+.googleapis.cn"
      - "+.googleapis.com"
      - "+.gvt1.com"
  fake-ip-filter:
    - "*.lan"
    - "stun.*.*.*"
    - "stun.*.*"
    - time.windows.com
    - time.nist.gov
    - time.apple.com
    - time.asia.apple.com
    - "*.ntp.org.cn"
    - "*.openwrt.pool.ntp.org"
    - time1.cloud.tencent.com
    - time.ustc.edu.cn
    - pool.ntp.org
    - ntp.ubuntu.com
    - ntp.aliyun.com
    - ntp1.aliyun.com
    - ntp2.aliyun.com
    - ntp3.aliyun.com
    - ntp4.aliyun.com
    - ntp5.aliyun.com
    - ntp6.aliyun.com
    - ntp7.aliyun.com
    - time1.aliyun.com
    - time2.aliyun.com
    - time3.aliyun.com
    - time4.aliyun.com
    - time5.aliyun.com
    - time6.aliyun.com
    - time7.aliyun.com
    - "*.time.edu.cn"
    - time1.apple.com
    - time2.apple.com
    - time3.apple.com
    - time4.apple.com
    - time5.apple.com
    - time6.apple.com
    - time7.apple.com
    - time1.google.com
    - time2.google.com
    - time3.google.com
    - time4.google.com
    - music.163.com
    - "*.music.163.com"
    - "*.126.net"
    - musicapi.taihe.com
    - music.taihe.com
    - songsearch.kugou.com
    - trackercdn.kugou.com
    - "*.kuwo.cn"
    - api-jooxtt.sanook.com
    - api.joox.com
    - joox.com
    - y.qq.com
    - "*.y.qq.com"
    - streamoc.music.tc.qq.com
    - mobileoc.music.tc.qq.com
    - isure.stream.qqmusic.qq.com
    - dl.stream.qqmusic.qq.com
    - aqqmusic.tc.qq.com
    - amobile.music.tc.qq.com
    - "*.xiami.com"
    - "*.music.migu.cn"
    - music.migu.cn
    - "*.msftconnecttest.com"
    - "*.msftncsi.com"
    - localhost.ptlogin2.qq.com
    - "*.*.*.srv.nintendo.net"
    - "*.*.stun.playstation.net"
    - "xbox.*.*.microsoft.com"
    - "*.ipv6.microsoft.com"
    - "*.*.xboxlive.com"
    - speedtest.cros.wr.pvp.net

profile:
  store-selected: true
  store-fake-ip: false

sniffer:
  enable: true
  parse-pure-ip: true
  sniff:
    HTTP:
      ports: [80, 8080-8880]
      override-destination: true
    QUIC:
      ports: [443, 8443]
    TLS:
      ports: [443, 8443]

geodata-mode: true
geo-auto-update: true
geodata-loader: standard
geo-update-interval: 24
geox-url:
  geoip: https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geoip.dat
  geosite: https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geosite.dat
  mmdb: https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/country.mmdb
  asn: https://github.com/xishang0128/geoip/releases/download/latest/GeoLite2-ASN.mmdb

proxies: # LEAVE THIS LINE!

proxy-groups:
  - name: "🚀 节点选择"
    type: select
    proxies:
      - "⚡ 自动选择"
      - DIRECT
      - REJECT
      # REMNAWAVE_PROXIES

  - name: "⚡ 自动选择"
    type: url-test
    proxies:
      # REMNAWAVE_PROXIES
    url: "https://www.gstatic.com/generate_204"
    interval: 300
    lazy: false

  - name: "🛑 广告拦截"
    type: select
    proxies:
      - REJECT
      - DIRECT
      - "🚀 节点选择"

  - name: "🤖 AI 服务"
    type: select
    proxies:
      - "🚀 节点选择"
      - "⚡ 自动选择"
      - DIRECT
      - REJECT
      # REMNAWAVE_PROXIES

  - name: "📹 油管视频"
    type: select
    proxies:
      - "🚀 节点选择"
      - "⚡ 自动选择"
      - DIRECT
      - REJECT
      # REMNAWAVE_PROXIES

  - name: "🔍 谷歌服务"
    type: select
    proxies:
      - "🚀 节点选择"
      - "⚡ 自动选择"
      - DIRECT
      - REJECT
      # REMNAWAVE_PROXIES

  - name: "Ⓜ️ 微软服务"
    type: select
    proxies:
      - "🚀 节点选择"
      - "⚡ 自动选择"
      - DIRECT
      - REJECT
      # REMNAWAVE_PROXIES

  - name: "🍏 苹果服务"
    type: select
    proxies:
      - "🚀 节点选择"
      - "⚡ 自动选择"
      - DIRECT
      - REJECT
      # REMNAWAVE_PROXIES

  - name: "📲 电报消息"
    type: select
    proxies:
      - "🚀 节点选择"
      - "⚡ 自动选择"
      - DIRECT
      - REJECT
      # REMNAWAVE_PROXIES

  - name: "🐱 代码托管"
    type: select
    proxies:
      - "🚀 节点选择"
      - "⚡ 自动选择"
      - DIRECT
      - REJECT
      # REMNAWAVE_PROXIES

  - name: "🏠 私有网络"
    type: select
    proxies:
      - DIRECT
      - REJECT
      - "🚀 节点选择"
      - "⚡ 自动选择"
      # REMNAWAVE_PROXIES

  - name: "🔒 国内服务"
    type: select
    proxies:
      - DIRECT
      - REJECT
      - "🚀 节点选择"
      - "⚡ 自动选择"
      # REMNAWAVE_PROXIES

  - name: "🌍 非中国"
    type: select
    proxies:
      - "🚀 节点选择"
      - "⚡ 自动选择"
      - DIRECT
      - REJECT
      # REMNAWAVE_PROXIES

  - name: "🐟 漏网之鱼"
    type: select
    proxies:
      - "🚀 节点选择"
      - "⚡ 自动选择"
      - DIRECT
      - REJECT
      # REMNAWAVE_PROXIES

rule-providers:
  category-ads-all:
    type: http
    behavior: domain
    url: "https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geosite/category-ads-all.mrs"
    path: ./ruleset/category-ads-all.mrs
    interval: 86400
    format: mrs
  private:
    type: http
    behavior: domain
    url: "https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geosite/private.mrs"
    path: ./ruleset/private.mrs
    interval: 86400
    format: mrs
  private-ip:
    type: http
    behavior: ipcidr
    url: "https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geoip/private.mrs"
    path: ./ruleset/private-ip.mrs
    interval: 86400
    format: mrs
  geolocation-cn:
    type: http
    behavior: domain
    url: "https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geosite/geolocation-cn.mrs"
    path: ./ruleset/geolocation-cn.mrs
    interval: 86400
    format: mrs
  cn-ip:
    type: http
    behavior: ipcidr
    url: "https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geoip/cn.mrs"
    path: ./ruleset/cn-ip.mrs
    interval: 86400
    format: mrs
  geolocation-!cn:
    type: http
    behavior: domain
    url: "https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geosite/geolocation-!cn.mrs"
    path: ./ruleset/geolocation-!cn.mrs
    interval: 86400
    format: mrs
  category-ai-chat-!cn:
    type: http
    behavior: domain
    url: "https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geosite/category-ai-chat-!cn.mrs"
    path: ./ruleset/category-ai-chat-!cn.mrs
    interval: 86400
    format: mrs
  openai:
    type: http
    behavior: domain
    url: "https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geosite/openai.mrs"
    path: ./ruleset/openai.mrs
    interval: 86400
    format: mrs
  anthropic:
    type: http
    behavior: domain
    url: "https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geosite/anthropic.mrs"
    path: ./ruleset/anthropic.mrs
    interval: 86400
    format: mrs
  youtube:
    type: http
    behavior: domain
    url: "https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geosite/youtube.mrs"
    path: ./ruleset/youtube.mrs
    interval: 86400
    format: mrs
  google:
    type: http
    behavior: domain
    url: "https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geosite/google.mrs"
    path: ./ruleset/google.mrs
    interval: 86400
    format: mrs
  google-ip:
    type: http
    behavior: ipcidr
    url: "https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geoip/google.mrs"
    path: ./ruleset/google-ip.mrs
    interval: 86400
    format: mrs
  microsoft:
    type: http
    behavior: domain
    url: "https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geosite/microsoft.mrs"
    path: ./ruleset/microsoft.mrs
    interval: 86400
    format: mrs
  onedrive:
    type: http
    behavior: domain
    url: "https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geosite/onedrive.mrs"
    path: ./ruleset/onedrive.mrs
    interval: 86400
    format: mrs
  apple:
    type: http
    behavior: domain
    url: "https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geosite/apple.mrs"
    path: ./ruleset/apple.mrs
    interval: 86400
    format: mrs
  icloud:
    type: http
    behavior: domain
    url: "https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geosite/icloud.mrs"
    path: ./ruleset/icloud.mrs
    interval: 86400
    format: mrs
  telegram:
    type: http
    behavior: domain
    url: "https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geosite/telegram.mrs"
    path: ./ruleset/telegram.mrs
    interval: 86400
    format: mrs
  telegram-ip:
    type: http
    behavior: ipcidr
    url: "https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geoip/telegram.mrs"
    path: ./ruleset/telegram-ip.mrs
    interval: 86400
    format: mrs
  github:
    type: http
    behavior: domain
    url: "https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geosite/github.mrs"
    path: ./ruleset/github.mrs
    interval: 86400
    format: mrs
  gitlab:
    type: http
    behavior: domain
    url: "https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geosite/gitlab.mrs"
    path: ./ruleset/gitlab.mrs
    interval: 86400
    format: mrs
  atlassian:
    type: http
    behavior: domain
    url: "https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geosite/atlassian.mrs"
    path: ./ruleset/atlassian.mrs
    interval: 86400
    format: mrs
  cn:
    type: http
    behavior: domain
    url: "https://github.com/MetaCubeX/meta-rules-dat/raw/refs/heads/meta/geo/geosite/cn.mrs"
    path: ./ruleset/cn.mrs
    interval: 86400
    format: mrs

rules:
  - RULE-SET,category-ads-all,🛑 广告拦截
  - RULE-SET,category-ai-chat-!cn,🤖 AI 服务
  - RULE-SET,openai,🤖 AI 服务
  - RULE-SET,anthropic,🤖 AI 服务
  - RULE-SET,youtube,📹 油管视频
  - RULE-SET,google,🔍 谷歌服务
  - RULE-SET,google-ip,🔍 谷歌服务,no-resolve
  - RULE-SET,private,🏠 私有网络
  - RULE-SET,private-ip,🏠 私有网络,no-resolve
  - RULE-SET,geolocation-cn,🔒 国内服务
  - RULE-SET,cn-ip,🔒 国内服务,no-resolve
  - RULE-SET,telegram,📲 电报消息
  - RULE-SET,telegram-ip,📲 电报消息,no-resolve
  - RULE-SET,github,🐱 代码托管
  - RULE-SET,gitlab,🐱 代码托管
  - RULE-SET,atlassian,🐱 代码托管
  - RULE-SET,microsoft,Ⓜ️ 微软服务
  - RULE-SET,onedrive,Ⓜ️ 微软服务
  - RULE-SET,apple,🍏 苹果服务
  - RULE-SET,icloud,🍏 苹果服务
  - RULE-SET,geolocation-!cn,🌍 非中国
  - RULE-SET,cn,🔒 国内服务
  - MATCH,🐟 漏网之鱼`;

function renderMihomoProxyNameList(proxyNames: string[], indent: string) {
  const names = proxyNames.length > 0 ? proxyNames : MIHOMO_PROXY_NAME_FALLBACK;
  return names.map((name) => `${indent}- ${yamlQuote(name)}`).join("\n");
}

function renderMihomoSubscriptionTemplate(proxies: JsonRecord[], proxyNames: string[]) {
  const proxyYaml = toYaml(proxies, 2);
  return MIHOMO_SUBSCRIPTION_TEMPLATE
    .replace("proxies: # LEAVE THIS LINE!", `proxies: # LEAVE THIS LINE!\n${proxyYaml}`)
    .replace(/^(\s*)# REMNAWAVE_PROXIES$/gm, (_match: string, indent: string) => renderMihomoProxyNameList(proxyNames, indent));
}

export function buildClashSubscriptionYaml(nodeClients: ProxyNodeContext[]): string {
  const proxies = dedupeProxyNames(
    nodeClients.flatMap((nodeClient) => {
      const client = findClient(nodeClient);
      return getTargets(nodeClient)
        .map((target) => buildClashProxy(nodeClient, target, client))
        .filter((item): item is JsonRecord => item != null);
    }),
  );
  const proxyNames = proxies.map((proxy) => asString(proxy.name) ?? "J-Board");

  return `${renderMihomoSubscriptionTemplate(proxies, proxyNames)}\n`;
}

function getVmessSecurity(settings: JsonRecord, client: PanelClient | null) {
  return asString(client?.security) ?? firstClientValue(settings, "security") ?? "auto";
}

function getVlessFlow(settings: JsonRecord, client: PanelClient | null) {
  return asString(client?.flow) ?? firstClientValue(settings, "flow");
}

function buildVmessUri(nodeClient: ProxyNodeContext, target: LinkTarget, client: PanelClient | null) {
  const stream = getStream(nodeClient);
  const settings = getSettings(nodeClient);
  const network = asString(stream.network) ?? "tcp";
  const security = target.securityOverride && target.securityOverride !== "same"
    ? target.securityOverride
    : (asString(stream.security) ?? "none");
  const label = getDisplayName(nodeClient, target);
  const obj: JsonRecord = {
    v: "2",
    ps: label,
    add: target.address,
    port: target.port,
    id: asString(client?.id) ?? nodeClient.uuid,
    scy: getVmessSecurity(settings, client),
    tls: security,
    type: "none",
  };

  applyNetworkObj(stream, network, obj);
  applyFinalMaskObj(stream, obj);
  if (security === "tls") applyTlsObj(stream, obj);

  return `vmess://${Buffer.from(JSON.stringify(obj, null, 2)).toString("base64")}`;
}

function buildVlessUri(nodeClient: ProxyNodeContext, target: LinkTarget, client: PanelClient | null) {
  const stream = getStream(nodeClient);
  const settings = getSettings(nodeClient);
  const params = buildStreamParams(stream, {
    settings,
    includeEncryption: true,
    includeSecurityNone: true,
    flow: getVlessFlow(settings, client),
    securityOverride: target.securityOverride,
  });
  const uuid = asString(client?.id) ?? nodeClient.uuid;
  return appendQueryAndHash(
    `vless://${uuid}@${formatHost(target.address)}:${target.port}`,
    params,
    getDisplayName(nodeClient, target),
  );
}

function buildTrojanUri(nodeClient: ProxyNodeContext, target: LinkTarget, client: PanelClient | null) {
  const stream = getStream(nodeClient);
  const params = buildStreamParams(stream, {
    includeSecurityNone: true,
    flow: asString(client?.flow),
    securityOverride: target.securityOverride,
  });
  const password = asString(client?.password) ?? nodeClient.uuid;
  return appendQueryAndHash(
    `trojan://${password}@${formatHost(target.address)}:${target.port}`,
    params,
    getDisplayName(nodeClient, target),
  );
}

function buildShadowsocksUri(nodeClient: ProxyNodeContext, target: LinkTarget, client: PanelClient | null) {
  const settings = getSettings(nodeClient);
  const stream = getStream(nodeClient);
  const method = asString(settings.method) ?? asString(client?.method) ?? "chacha20-ietf-poly1305";
  const inboundPassword = asString(settings.password) ?? asString(settings.serverKey);
  const clientPassword = asString(client?.password) ?? nodeClient.uuid;
  const password = method.startsWith("2022-") && inboundPassword
    ? `${inboundPassword}:${clientPassword}`
    : clientPassword;
  const encoded = Buffer.from(`${method}:${password}`).toString("base64");
  const params = buildStreamParams(stream, {
    securityOverride: target.securityOverride,
  });

  return appendQueryAndHash(
    `ss://${encoded}@${formatHost(target.address)}:${target.port}`,
    params,
    getDisplayName(nodeClient, target),
  );
}

function findSalamanderPassword(stream: JsonRecord): string | null {
  const finalmask = asRecord(stream.finalmask);
  for (const mask of asArray(finalmask?.udp)) {
    const record = asRecord(mask);
    if (record?.type !== "salamander") continue;
    const settings = asRecord(record.settings);
    const password = asString(settings?.password);
    if (password) return password;
  }
  return asString(getDeep(stream, "obfsPassword")) ?? null;
}

function buildHysteriaUri(nodeClient: ProxyNodeContext, target: LinkTarget, client: PanelClient | null) {
  const stream = getStream(nodeClient);
  const settings = getSettings(nodeClient);
  const protocol = asNumber(settings.version) === 1 ? "hysteria" : "hysteria2";
  const params = new URLSearchParams();
  const auth = asString(client?.auth) ?? nodeClient.uuid;
  const obfsPassword = findSalamanderPassword(stream);

  applyTlsParams(stream, params, true);
  applyFinalMaskParams(stream, params);
  if (obfsPassword) {
    params.set("obfs", "salamander");
    params.set("obfs-password", obfsPassword);
  }

  return appendQueryAndHash(
    `${protocol}://${auth}@${formatHost(target.address)}:${target.port}`,
    params,
    getDisplayName(nodeClient, target),
  );
}

export function buildSingleNodeUri(nodeClient: ProxyNodeContext): string {
  const protocol = nodeClient.inbound.protocol.toLowerCase();
  const client = findClient(nodeClient);
  const links = getTargets(nodeClient).map((target) => {
    switch (protocol) {
      case "vmess":
        return buildVmessUri(nodeClient, target, client);
      case "vless":
        return buildVlessUri(nodeClient, target, client);
      case "trojan":
        return buildTrojanUri(nodeClient, target, client);
      case "shadowsocks":
        return buildShadowsocksUri(nodeClient, target, client);
      case "hysteria2":
        return buildHysteriaUri(nodeClient, target, client);
      default:
        return "";
    }
  }).filter(Boolean);

  return links.join("\n");
}

export async function generateSingleNodeUri(subscriptionId: string): Promise<string> {
  const sub = await prisma.userSubscription.findUniqueOrThrow({
    where: { id: subscriptionId },
    include: {
      nodeClient: {
        include: {
          inbound: { include: { server: true } },
        },
      },
    },
  });

  if (sub.status !== "ACTIVE") return "";
  if (!sub.nodeClient) return "";
  return buildSingleNodeUri(sub.nodeClient);
}

function encodeSubscriptionContent(uri: string, format: SubscriptionOutputFormat) {
  if (!uri) return "";
  return format === "base64" ? Buffer.from(uri).toString("base64") : uri;
}

export async function generateSubscriptionContent(
  subscriptionId: string,
  format: SubscriptionOutputFormat = "base64",
): Promise<string> {
  const sub = await prisma.userSubscription.findUniqueOrThrow({
    where: { id: subscriptionId },
    include: {
      nodeClient: {
        include: {
          inbound: { include: { server: true } },
        },
      },
    },
  });

  if (sub.status !== "ACTIVE" || !sub.nodeClient) return "";
  if (format === "clash") return buildClashSubscriptionYaml([sub.nodeClient]);
  return encodeSubscriptionContent(buildSingleNodeUri(sub.nodeClient), format);
}

export async function generateAggregateSubscriptionContent(
  userId: string,
  format: SubscriptionOutputFormat = "base64",
): Promise<string> {
  const subscriptions = await prisma.userSubscription.findMany({
    where: {
      userId,
      status: "ACTIVE",
      endDate: { gt: new Date() },
      plan: { type: "PROXY" },
      nodeClient: { isNot: null },
    },
    include: {
      nodeClient: {
        include: {
          inbound: { include: { server: true } },
        },
      },
    },
    orderBy: [{ endDate: "asc" }, { createdAt: "asc" }],
  });

  const nodeClients = subscriptions
    .map((subscription) => subscription.nodeClient)
    .filter((nodeClient): nodeClient is NonNullable<typeof nodeClient> => nodeClient != null);

  if (format === "clash") return buildClashSubscriptionYaml(nodeClients);

  const content = nodeClients
    .map((nodeClient) => buildSingleNodeUri(nodeClient))
    .filter(Boolean)
    .join("\n");

  return encodeSubscriptionContent(content, format);
}
