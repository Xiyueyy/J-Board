"use client";

import { useMemo, useState } from "react";
import { Bell, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AnnouncementItem {
  id: string;
  title: string;
  body: string;
  displayType: "INLINE" | "BIG" | "POPUP";
  dismissible: boolean;
}

function isDismissed(id: string) {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(`jboard:announcement:dismissed:${id}`) === "1";
}

function dismiss(id: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`jboard:announcement:dismissed:${id}`, "1");
}

export function AnnouncementPresenter({
  announcements,
}: {
  announcements: AnnouncementItem[];
}) {
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  const activeAnnouncements = useMemo(
    () =>
      announcements.filter((announcement) => {
        if (dismissedIds.includes(announcement.id)) return false;
        if (announcement.dismissible && isDismissed(announcement.id)) return false;
        return true;
      }),
    [announcements, dismissedIds],
  );

  const bigAnnouncements = activeAnnouncements.filter((item) => item.displayType === "BIG");
  const inlineAnnouncements = activeAnnouncements.filter((item) => item.displayType === "INLINE");
  const popupAnnouncement = activeAnnouncements.find((item) => item.displayType === "POPUP") ?? null;

  function handleDismiss(id: string) {
    dismiss(id);
    setDismissedIds((prev) => [...prev, id]);
  }

  return (
    <>
      {(bigAnnouncements.length > 0 || inlineAnnouncements.length > 0) && (
        <div className="mb-4 space-y-4">
          {bigAnnouncements.map((announcement) => (
            <div
              key={announcement.id}
              className="surface-card overflow-hidden rounded-xl px-5 py-4"
            >
              <div className="max-w-3xl space-y-1.5">
                <p className="inline-flex items-center gap-1.5 text-xs font-medium tracking-wide text-amber-700 dark:text-amber-300">
                  <Sparkles className="size-3" /> 重要公告
                </p>
                <h3 className="text-lg font-semibold tracking-[-0.02em] text-balance">{announcement.title}</h3>
                <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground text-pretty">{announcement.body}</p>
              </div>
              {announcement.dismissible && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-4 top-4"
                  onClick={() => handleDismiss(announcement.id)}
                >
                  关闭
                </Button>
              )}
            </div>
          ))}

          {inlineAnnouncements.map((announcement) => (
            <div key={announcement.id} className="surface-card rounded-lg px-4 py-3">
              <div className="pr-14">
                <p className="inline-flex items-center gap-2 text-sm font-semibold">
                  <Bell className="size-4 text-primary" /> {announcement.title}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{announcement.body}</p>
              </div>
              {announcement.dismissible && (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="absolute right-3 top-3"
                  onClick={() => handleDismiss(announcement.id)}
                >
                  关闭
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {popupAnnouncement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/10 px-4 backdrop-blur-sm">
          <div className="surface-card w-full max-w-lg overflow-hidden rounded-xl p-5 shadow-lg">
            <div>
              <p className="inline-flex items-center gap-1.5 text-xs font-medium tracking-wide text-primary">
                <Bell className="size-3" /> 弹窗公告
              </p>
              <h3 className="mt-1.5 text-lg font-semibold tracking-[-0.02em] text-balance">{popupAnnouncement.title}</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground text-pretty">
                {popupAnnouncement.body}
              </p>
              <div className="mt-4 flex justify-end gap-2">
                {popupAnnouncement.dismissible && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleDismiss(popupAnnouncement.id)}
                  >
                    我知道了
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
