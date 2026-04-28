import Link from "next/link";
import { ArrowRight, ReceiptText, Radio } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export function DashboardActions() {
  return (
    <>
      <Link href="/store" className={buttonVariants({ size: "lg" })}>
        购买套餐
        <ArrowRight className="size-4" />
      </Link>
      <Link href="/subscriptions" className={buttonVariants({ variant: "outline", size: "lg" })}>
        <Radio className="size-4" />
        管理订阅
      </Link>
      <Link href="/orders" className={buttonVariants({ variant: "ghost", size: "lg" })}>
        <ReceiptText className="size-4" />
        订单
      </Link>
    </>
  );
}
