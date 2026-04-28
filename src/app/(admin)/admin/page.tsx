import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "管理后台",
  description: "管理后台入口页。",
};

export default function AdminIndexPage() {
  redirect("/admin/dashboard");
}
