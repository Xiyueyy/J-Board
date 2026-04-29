import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getActiveSubscriptionRiskRestriction } from "@/services/subscription-risk-review";

export const metadata: Metadata = {
  title: {
    default: "支付中心",
    template: "%s | J-Board",
  },
  description: "选择支付方式并完成订单结算。",
};

export default async function PaymentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  if (session.user.role === "ADMIN") {
    redirect("/admin/dashboard");
  }

  const restriction = await getActiveSubscriptionRiskRestriction(session.user.id);
  if (restriction) {
    redirect("/support?riskEventId=" + restriction.id);
  }

  return children;
}
