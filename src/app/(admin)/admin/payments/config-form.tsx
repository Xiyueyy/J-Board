"use client";

import type { ChangeEvent } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { savePaymentConfig } from "@/actions/admin/payments";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "sonner";

interface Field {
  key: string;
  label: string;
  placeholder?: string;
  secret?: boolean;
  type?: "text" | "textarea" | "checkboxes" | "image";
  options?: { value: string; label: string }[];
}

interface Props {
  provider: string;
  fields: Field[];
  currentConfig?: Record<string, string>;
  secretConfigured?: Record<string, boolean>;
  enabled: boolean;
}

export function PaymentConfigForm({
  provider,
  fields,
  currentConfig,
  secretConfigured = {},
  enabled: initialEnabled,
}: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);

  // Track checkbox field values (comma-separated strings)
  const [checkboxValues, setCheckboxValues] = useState<Record<string, Set<string>>>(() => {
    const init: Record<string, Set<string>> = {};
    for (const field of fields) {
      if (field.type === "checkboxes") {
        const raw = currentConfig?.[field.key] || "";
        init[field.key] = new Set(raw.split(",").map((s) => s.trim()).filter(Boolean));
      }
    }
    return init;
  });
  const [imageValues, setImageValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const field of fields) {
      if (field.type === "image") init[field.key] = currentConfig?.[field.key] || "";
    }
    return init;
  });

  function toggleCheckbox(fieldKey: string, value: string) {
    setCheckboxValues((prev) => {
      const next = new Set(prev[fieldKey]);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return { ...prev, [fieldKey]: next };
    });
  }

  function handleImageChange(fieldKey: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("请上传图片文件");
      event.target.value = "";
      return;
    }
    if (file.size > 1024 * 1024) {
      toast.error("图片不能超过 1MB，建议先压缩收款码");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const value = typeof reader.result === "string" ? reader.result : "";
      setImageValues((prev) => ({ ...prev, [fieldKey]: value }));
    };
    reader.onerror = () => toast.error("读取图片失败，请重新上传");
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setSaving(true);
    const formData = new FormData(form);
    const secretInputs = fields
      .filter((field) => field.secret)
      .map((field) => form.elements.namedItem(field.key))
      .filter((input): input is HTMLInputElement => input instanceof HTMLInputElement);
    const config: Record<string, string> = {};
    for (const field of fields) {
      if (field.type === "checkboxes") {
        config[field.key] = Array.from(checkboxValues[field.key] ?? []).join(",");
      } else if (field.type === "image") {
        config[field.key] = imageValues[field.key] || "";
      } else {
        config[field.key] = (formData.get(field.key) as string) || "";
      }
    }

    try {
      await savePaymentConfig(provider, config, enabled);
      for (const input of secretInputs) {
        input.value = "";
      }
      toast.success("保存成功");
    } catch (error) {
      toast.error(getErrorMessage(error, "保存失败"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="form-panel space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((field) => {
          if (field.type === "checkboxes") {
            return (
              <div key={field.key} className="sm:col-span-2">
                <Label>{field.label}</Label>
                <div className="mt-3 flex flex-wrap gap-3">
                  {field.options?.map((opt) => (
                    <label key={opt.value} className="choice-card flex cursor-pointer items-center gap-2 px-3 py-2">
                      <input
                        type="checkbox"
                        className="size-4 rounded border-border accent-primary"
                        checked={checkboxValues[field.key]?.has(opt.value) ?? false}
                        onChange={() => toggleCheckbox(field.key, opt.value)}
                      />
                      <span className="text-sm">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          }

          if (field.type === "image") {
            const imageValue = imageValues[field.key] || "";
            return (
              <div key={field.key} className="sm:col-span-2">
                <Label>{field.label}</Label>
                <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(event) => handleImageChange(field.key, event)}
                  />
                  {imageValue && (
                    <div className="flex items-center gap-3 rounded-lg border border-border bg-white p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imageValue} alt="收款码预览" className="size-24 rounded object-contain" />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setImageValues((prev) => ({ ...prev, [field.key]: "" }))}
                      >
                        清除
                      </Button>
                    </div>
                  )}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">支持 jpg/png/webp，建议小于 1MB。保存后用户付款页会直接展示这张收款码。</p>
              </div>
            );
          }

          if (field.type === "textarea") {
            return (
              <div key={field.key} className="sm:col-span-2">
                <Label>{field.label}</Label>
                <textarea
                  name={field.key}
                  rows={3}
                  className="mt-2 min-h-24 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
                  placeholder={field.placeholder}
                  defaultValue={currentConfig?.[field.key] || ""}
                />
              </div>
            );
          }

          return (
            <div key={field.key}>
              <Label>{field.label}</Label>
              <Input
                name={field.key}
                type={field.secret ? "password" : "text"}
                placeholder={field.secret && secretConfigured[field.key] ? "留空保持不变" : field.placeholder}
                defaultValue={field.secret ? "" : currentConfig?.[field.key] || ""}
              />
            </div>
          );
        })}
      </div>
      <div className="flex flex-col gap-3 border-t border-border/50 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Switch checked={enabled} onCheckedChange={setEnabled} />
          <span className="text-sm">{enabled ? "已启用" : "未启用"}</span>
        </div>
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? "保存中..." : "保存配置"}
        </Button>
      </div>
    </form>
  );
}
