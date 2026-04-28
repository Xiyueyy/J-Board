import { randomBytes, randomUUID } from "crypto";

function getShadowsocks2022KeyLength(method: string): number | null {
  const normalized = method.toLowerCase();
  if (normalized === "2022-blake3-aes-128-gcm") return 16;
  if (normalized === "2022-blake3-aes-256-gcm") return 32;
  if (normalized === "2022-blake3-chacha20-poly1305") return 32;
  return null;
}

function parseShadowsocksMethod(rawSettings: unknown): string {
  if (!rawSettings || typeof rawSettings !== "object") {
    return "chacha20-ietf-poly1305";
  }

  const settings = rawSettings as {
    method?: unknown;
    clients?: Array<{ method?: unknown }>;
  };

  if (typeof settings.method === "string" && settings.method.trim()) {
    return settings.method.trim();
  }

  const firstClientMethod = settings.clients?.[0]?.method;
  if (typeof firstClientMethod === "string" && firstClientMethod.trim()) {
    return firstClientMethod.trim();
  }

  return "chacha20-ietf-poly1305";
}

export function generateNodeClientCredential(
  protocol: string,
  inboundSettings: unknown,
): string {
  if (protocol !== "SHADOWSOCKS") {
    return randomUUID();
  }

  const method = parseShadowsocksMethod(inboundSettings);
  const keyBytes = getShadowsocks2022KeyLength(method);
  if (!keyBytes) {
    return randomUUID();
  }

  return randomBytes(keyBytes).toString("base64");
}
