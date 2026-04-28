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

function getAggregateSubscriptionSecret() {
  const secret = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET ?? process.env.DATABASE_URL;
  if (!secret) {
    throw new Error("缺少订阅链接签名密钥，请配置 NEXTAUTH_SECRET");
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

export async function generateSubscriptionContent(subscriptionId: string): Promise<string> {
  const uri = await generateSingleNodeUri(subscriptionId);
  if (!uri) return "";
  return Buffer.from(uri).toString("base64");
}

export async function generateAggregateSubscriptionContent(userId: string): Promise<string> {
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

  const content = subscriptions
    .map((subscription) => subscription.nodeClient ? buildSingleNodeUri(subscription.nodeClient) : "")
    .filter(Boolean)
    .join("\n");

  return content ? Buffer.from(content).toString("base64") : "";
}
