interface BarkPushInput {
  endpoint: string;
  title: string;
  body: string;
  url?: string | null;
}

function truncate(value: string, max = 480) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function buildBarkUrl(input: BarkPushInput) {
  const endpoint = input.endpoint.trim().replace(/\/+$/, "");
  if (!endpoint) return null;

  const parsed = new URL(endpoint);
  const base = `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}`;
  const target = new URL(
    `${base}/${encodeURIComponent(truncate(input.title, 80))}/${encodeURIComponent(truncate(input.body))}`,
  );

  parsed.searchParams.forEach((value, key) => {
    target.searchParams.set(key, value);
  });
  if (input.url) {
    target.searchParams.set("url", input.url);
  }

  return target;
}

export async function sendBarkPush(input: BarkPushInput) {
  const endpoint = input.endpoint.trim();
  if (!endpoint) return false;

  try {
    const target = buildBarkUrl({ ...input, endpoint });
    if (!target) return false;

    const response = await fetch(target, {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error("Bark push failed:", response.status, text.slice(0, 300));
      return false;
    }

    return true;
  } catch (error) {
    console.error("Bark push error:", error);
    return false;
  }
}
