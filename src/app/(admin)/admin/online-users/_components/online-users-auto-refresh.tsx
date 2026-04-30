"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function OnlineUsersAutoRefresh({ intervalSeconds = 15 }: { intervalSeconds?: number }) {
  const router = useRouter();
  const [secondsLeft, setSecondsLeft] = useState(intervalSeconds);
  const [isPending, startTransition] = useTransition();

  function refresh() {
    setSecondsLeft(intervalSeconds);
    startTransition(() => router.refresh());
  }

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          startTransition(() => router.refresh());
          return intervalSeconds;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [intervalSeconds, router]);

  return (
    <Button type="button" variant="outline" size="sm" onClick={refresh} disabled={isPending}>
      <RefreshCw className={cn("size-4", isPending && "animate-spin")} />
      {isPending ? "刷新中" : `${secondsLeft}s 自动刷新`}
    </Button>
  );
}
