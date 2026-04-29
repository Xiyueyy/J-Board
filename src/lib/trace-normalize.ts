const CJK_PATTERN = /[\u3400-\u9fff]/g;
const MOJIBAKE_PATTERN = /[ÃÂÐÑØÙÚÛÜÝÞßæøåäö]/g;

function scoreText(value: string) {
  return {
    cjkCount: (value.match(CJK_PATTERN) ?? []).length,
    mojibakeCount: (value.match(MOJIBAKE_PATTERN) ?? []).length,
    replacementCount: (value.match(/�/g) ?? []).length,
  };
}

function chooseBetterText(original: string, candidate: string) {
  if (!candidate || candidate === original) return original;

  const originalScore = scoreText(original);
  const candidateScore = scoreText(candidate);

  if (candidateScore.replacementCount > originalScore.replacementCount) {
    return original;
  }

  if (candidateScore.cjkCount > originalScore.cjkCount) {
    return candidate;
  }

  if (candidateScore.mojibakeCount < originalScore.mojibakeCount) {
    return candidate;
  }

  return original;
}

function decodeUnicodeEscapes(value: string) {
  if (!/\\u[0-9a-fA-F]{4}|\\x[0-9a-fA-F]{2}/.test(value)) return value;
  return value
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    )
    .replace(/\\x([0-9a-fA-F]{2})/g, (_, hex: string) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    );
}

export function normalizeTraceText(raw: unknown) {
  if (raw == null) return "";

  let text = String(raw).trim();
  if (!text) return "";

  if (/%[0-9a-fA-F]{2}/.test(text)) {
    try {
      text = chooseBetterText(text, decodeURIComponent(text));
    } catch {
      // ignore invalid URI encodings
    }
  }

  text = chooseBetterText(text, decodeUnicodeEscapes(text));

  try {
    text = chooseBetterText(text, Buffer.from(text, "latin1").toString("utf8"));
  } catch {
    // ignore non-convertible content
  }

  return text.normalize("NFC");
}

function toSafeNumber(value: unknown, fallback: number) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return numberValue;
}

export interface NormalizedTraceHop {
  hop: number;
  ip: string;
  geo: string;
  latency: number;
  asn?: string;
  owner?: string;
  isp?: string;
}

export function normalizeTraceHops(hops: unknown): NormalizedTraceHop[] {
  if (!Array.isArray(hops)) return [];

  return hops
    .map((hopItem, index) => {
      const hopObject =
        hopItem && typeof hopItem === "object"
          ? (hopItem as Record<string, unknown>)
          : {};

      return {
        hop: Math.max(1, Math.trunc(toSafeNumber(hopObject.hop, index + 1))),
        ip: normalizeTraceText(hopObject.ip),
        geo: normalizeTraceText(hopObject.geo),
        latency: Math.max(0, toSafeNumber(hopObject.latency, 0)),
        asn: normalizeTraceText(hopObject.asn) || undefined,
        owner: normalizeTraceText(hopObject.owner) || undefined,
        isp: normalizeTraceText(hopObject.isp) || undefined,
      };
    })
    .filter((hop) => hop.ip || hop.geo || hop.latency > 0);
}
