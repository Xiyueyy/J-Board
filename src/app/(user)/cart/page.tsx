import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { ShoppingBag, ShoppingCart } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { EmptyState, PageHeader, PageShell } from "@/components/shared/page-shell";
import { buttonVariants } from "@/components/ui/button";
import { CartClient } from "./cart-client";
import { getCartPageData } from "./cart-data";

export const metadata: Metadata = {
  title: "购物车",
  description: "确认套餐清单并统一结算。",
};

export default async function CartPage() {
  const session = await getServerSession(authOptions);
  const data = await getCartPageData(session!.user.id);

  return (
    <PageShell>
      <PageHeader
        eyebrow="结算中心"
        title="购物车"
      />

      {data.items.length === 0 ? (
        <EmptyState
          eyebrow="购物车"
          icon={<ShoppingCart className="size-5" />}
          title="还没有加入任何套餐"
          description="从商店挑选适合你的连接或服务，加入购物车后再统一结算。"
          action={
            <Link href="/store" className={buttonVariants()}>
              <ShoppingBag className="size-4" />
              去商店看看
            </Link>
          }
        />
      ) : (
        <CartClient {...data} />
      )}
    </PageShell>
  );
}
