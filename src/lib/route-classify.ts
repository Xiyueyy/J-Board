import { normalizeTraceText, type NormalizedTraceHop } from "@/lib/trace-normalize";

function normalizeAsn(value: unknown) {
  const text = normalizeTraceText(value).toUpperCase();
  const match = text.match(/(?:^|\b)AS?\s*(\d{2,10})(?:\b|$)/);
  if (match) return match[1];
  return /^\d{2,10}$/.test(text) ? text : "";
}

function isIpInPrefix(ip: string, prefix: string) {
  return ip === prefix.slice(0, -1) || ip.startsWith(prefix);
}

function countMatches(values: string[], predicate: (value: string) => boolean) {
  return values.reduce((count, value) => count + (predicate(value) ? 1 : 0), 0);
}

export function classifyTraceRoute(input: {
  summary?: unknown;
  hops: Array<NormalizedTraceHop | { ip?: unknown; geo?: unknown; asn?: unknown; owner?: unknown; isp?: unknown }>;
}) {
  const summary = normalizeTraceText(input.summary).toUpperCase();
  const hopTexts = input.hops.map((hop) => [
    normalizeTraceText(hop.ip),
    normalizeTraceText(hop.geo),
    normalizeTraceText("owner" in hop ? hop.owner : ""),
    normalizeTraceText("isp" in hop ? hop.isp : ""),
    normalizeTraceText("asn" in hop ? hop.asn : ""),
  ].join(" ").toUpperCase());
  const combined = [summary, ...hopTexts].join(" ");
  const ips = input.hops.map((hop) => normalizeTraceText(hop.ip)).filter(Boolean);
  const asns = new Set<string>();

  for (const hop of input.hops) {
    const directAsn = normalizeAsn("asn" in hop ? hop.asn : "");
    if (directAsn) asns.add(directAsn);
  }
  for (const match of combined.matchAll(/(?:^|\b)AS\s*(\d{2,10})(?:\b|$)/g)) {
    asns.add(match[1]);
  }

  const hasAsn = (...values: string[]) => values.some((value) => asns.has(value));
  const hasText = (...values: string[]) => values.some((value) => combined.includes(value));
  const hasIpPrefix = (...prefixes: string[]) => ips.some((ip) => prefixes.some((prefix) => isIpInPrefix(ip, prefix)));

  const cn2Evidence = hasAsn("4809")
    || hasIpPrefix("59.43.")
    || hasText("CN2", "CTGNET", "CHINANET NEXT CARRYING NETWORK", "CHINA TELECOM GLOBAL");
  const cn2GiaText = hasText("CN2 GIA", "CN2GIA", "GIA", "GLOBAL INTERNET ACCESS");
  const ordinaryTelecomHops = countMatches(hopTexts, (text) => (
    text.includes("AS4134")
    || text.includes("CHINANET BACKBONE")
    || text.includes("CHINANET 163")
    || text.includes("163骨干")
  )) + countMatches(ips, (ip) => isIpInPrefix(ip, "202.97."));

  if (cn2Evidence) {
    if (cn2GiaText || ordinaryTelecomHops <= 1) return "CN2 GIA";
    return "CN2 GT";
  }

  if (hasAsn("9929", "10099") || hasText("CUII", "A网", "AS9929")) {
    return "AS9929";
  }
  if (hasText("CMIN2") || hasAsn("58807", "58809", "58813", "58819", "59807")) {
    return "CMIN2";
  }
  if (hasText("CMI") || hasAsn("58453")) {
    return "CMI";
  }
  if (hasAsn("4837") || hasText("AS4837")) {
    return "AS4837";
  }

  const normalizedSummary = normalizeTraceText(input.summary);
  return normalizedSummary && normalizedSummary !== "普通线路" ? normalizedSummary : "普通线路";
}
