import type { Metadata } from "next";
import { PayPageClient } from "./pay-page-client";

export const metadata: Metadata = {
  title: "订单支付",
  description: "选择支付方式并完成当前订单支付。",
};

export default async function PayPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;

  return <PayPageClient orderId={orderId} />;
}
