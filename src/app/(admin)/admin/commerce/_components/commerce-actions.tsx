"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/errors";
import { toggleCoupon, togglePromotionRule } from "@/actions/admin/commerce";

type ToggleKind = "coupon" | "promotion";

export function CommerceToggleButton({
  id,
  active,
  kind,
}: {
  id: string;
  active: boolean;
  kind: ToggleKind;
}) {
  const [pending, startTransition] = useTransition();
  const nextActive = !active;

  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "outline" : "default"}
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          try {
            if (kind === "coupon") await toggleCoupon(id, nextActive);
            if (kind === "promotion") await togglePromotionRule(id, nextActive);
            toast.success(nextActive ? "已启用" : "已停用");
          } catch (error) {
            toast.error(getErrorMessage(error, "操作失败"));
          }
        });
      }}
    >
      {pending ? "处理中..." : active ? "停用" : "启用"}
    </Button>
  );
}
