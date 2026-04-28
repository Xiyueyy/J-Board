"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import { CopyButton } from "@/components/shared/copy-button";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/errors";
import { revealStreamingCredential } from "./streaming-credential-action";

export function StreamingCredentialCard({
  subscriptionId,
}: {
  subscriptionId: string;
}) {
  const [loading, setLoading] = useState(false);
  const [credential, setCredential] = useState<{
    name: string;
    description: string | null;
    credentials: string;
  } | null>(null);

  async function handleReveal() {
    setLoading(true);
    try {
      const result = await revealStreamingCredential(subscriptionId);
      setCredential(result);
    } catch (error) {
      setCredential({
        name: "获取失败",
        description: null,
        credentials: getErrorMessage(error, "无法读取凭据"),
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-background p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <KeyRound className="size-4 text-primary" /> 账号凭据
        </div>
        {!credential && (
          <Button size="sm" variant="outline" onClick={() => void handleReveal()} disabled={loading}>
            {loading ? "读取中..." : "查看凭据"}
          </Button>
        )}
      </div>

      {credential ? (
        <>
          {credential.description && (
            <p className="text-xs leading-5 text-muted-foreground">{credential.description}</p>
          )}
          <div className="rounded-xl border border-border bg-muted/25 p-3 font-mono text-sm whitespace-pre-wrap break-words">
            {credential.credentials}
          </div>
          <CopyButton text={credential.credentials} />
        </>
      ) : (
        <p className="text-xs leading-5 text-muted-foreground">
          点击“查看凭据”后展示共享账号信息，只在需要时展开。
        </p>
      )}
    </div>
  );
}
