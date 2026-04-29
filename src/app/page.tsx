import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getActiveSession } from "@/lib/require-auth";

export const metadata: Metadata = {
  title: "首页",
  description: "J-Board 首页路由，会根据身份跳转到对应工作台。",
};

export default async function Home() {
  const session = await getActiveSession();
  if (!session) redirect("/login");
  if (session.user.role === "ADMIN") redirect("/admin/dashboard");
  redirect("/dashboard");
}
