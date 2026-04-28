"use client";

import { Turnstile } from "@marsidev/react-turnstile";

export function TurnstileWidget({
  siteKey,
  onSuccess,
}: {
  siteKey?: string | null;
  onSuccess: (token: string) => void;
}) {
  if (!siteKey) return null;
  return <Turnstile siteKey={siteKey} onSuccess={onSuccess} />;
}
