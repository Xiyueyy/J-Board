function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function sanitizeInboundSettings(settings: unknown) {
  const record = asRecord(settings);
  const displayName = stringValue(record?.displayName);
  return displayName ? { displayName } : {};
}

export function sanitizeStreamSettings(streamSettings: unknown) {
  const record = asRecord(streamSettings);
  if (!record) return null;

  const network = stringValue(record.network);
  const security = stringValue(record.security);
  const sanitized: Record<string, string> = {};
  if (network) sanitized.network = network;
  if (security) sanitized.security = security;

  return Object.keys(sanitized).length > 0 ? sanitized : null;
}
