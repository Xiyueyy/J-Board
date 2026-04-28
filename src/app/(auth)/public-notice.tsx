"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Bell } from "lucide-react";
import { fetchJson } from "@/lib/fetch-json";

interface PublicInfo {
  maintenanceNotice: string | null;
  siteNotice: string | null;
}

export function PublicNotice() {
  const [info, setInfo] = useState<PublicInfo | null>(null);

  useEffect(() => {
    void fetchJson<PublicInfo>("/api/public/app-info")
      .then(setInfo)
      .catch(() => {});
  }, []);

  if (!info) return null;

  return (
    <div className="mb-4 space-y-3">
      {info.maintenanceNotice && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2.5 text-sm leading-6 text-amber-900 dark:text-amber-200">
          <div className="flex gap-2">
            <AlertTriangle className="mt-1 size-4 shrink-0" />
            <span>{info.maintenanceNotice}</span>
          </div>
        </div>
      )}
      {info.siteNotice && (
        <div className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm leading-6 text-muted-foreground">
          <div className="flex gap-2">
            <Bell className="mt-1 size-4 shrink-0 text-primary" />
            <span>{info.siteNotice}</span>
          </div>
        </div>
      )}
    </div>
  );
}
