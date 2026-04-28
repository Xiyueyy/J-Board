"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";
import { revealCredential } from "./credential-action";

export function CredentialCell({ serviceId }: { serviceId: string }) {
  const [visible, setVisible] = useState(false);
  const [creds, setCreds] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    if (visible) {
      setVisible(false);
      return;
    }
    if (creds) {
      setVisible(true);
      return;
    }
    setLoading(true);
    try {
      const result = await revealCredential(serviceId);
      setCreds(result);
      setVisible(true);
    } catch {
      setCreds("[解密失败]");
      setVisible(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-xs max-w-xs truncate">
        {visible ? creds : "••••••••"}
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0"
        onClick={toggle}
        disabled={loading}
      >
        {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}
