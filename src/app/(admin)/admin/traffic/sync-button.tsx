"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { syncTrafficViews } from "@/actions/admin/traffic";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "sonner";

export function TrafficSyncButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <Button
      disabled={loading}
      onClick={() => {
        void (async () => {
          setLoading(true);
          try {
            const result = await syncTrafficViews();
            const failed = result.failed > 0 ? `，失败 ${result.failed} 个` : "";
            toast.success(`已同步 ${result.synced} 个客户端${failed}`);
            router.refresh();
          } catch (error) {
            toast.error(getErrorMessage(error, "同步失败"));
          } finally {
            setLoading(false);
          }
        })();
      }}
    >
      {loading ? "同步中..." : "同步 3x-ui 流量"}
    </Button>
  );
}
