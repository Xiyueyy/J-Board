import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "首页",
  description: "J-Board 首页路由，会根据身份跳转到对应工作台。",
};

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role === "ADMIN") redirect("/admin/dashboard");
  redirect("/dashboard");
}
