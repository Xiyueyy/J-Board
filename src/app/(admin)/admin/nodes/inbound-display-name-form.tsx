"use client";

import { useState } from "react";
import { updateInboundDisplayName } from "@/actions/admin/nodes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "sonner";

export function InboundDisplayNameForm({
  inboundId,
  defaultValue,
}: {
  inboundId: string;
  defaultValue: string;
}) {
  const [saving, setSaving] = useState(false);

  async function handleSubmit(formData: FormData) {
    setSaving(true);
    try {
      await updateInboundDisplayName(inboundId, formData);
      toast.success("前台名称已更新");
    } catch (error) {
      toast.error(getErrorMessage(error, "保存失败"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form action={handleSubmit} className="flex min-w-0 flex-1 items-center gap-2">
      <Input
        name="displayName"
        defaultValue={defaultValue}
        placeholder="例如 悉尼 · 日常优选"
        className="h-8 min-h-8 rounded-xl px-3 text-xs"
      />
      <Button type="submit" size="xs" variant="outline" disabled={saving}>
        {saving ? "保存中" : "保存"}
      </Button>
    </form>
  );
}
