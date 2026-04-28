import type { Metadata } from "next";
import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/admin/sidebar";
import { AdminMobileNav } from "@/components/admin/mobile-nav";
import { AnnouncementLoader } from "@/components/announcements/announcement-loader";
import { PageTransition } from "@/components/shared/page-transition";

export const metadata: Metadata = {
  title: {
    default: "管理后台",
    template: "%s | J-Board",
  },
  description: "管理用户、订单、套餐、节点和系统配置。",
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }
  if (session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  return (
    <div className="flex h-[100dvh] overflow-hidden p-0 md:p-3">
      <div className="hidden shrink-0 md:flex">
        <AdminSidebar />
      </div>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden md:pl-3">
        <AdminMobileNav />
        <main className="flex-1 overflow-auto px-3 py-4 sm:px-5 sm:py-6 md:pt-0 lg:px-7 lg:pb-7">
          <Suspense fallback={null}>
            <AnnouncementLoader userId={session.user.id} role="ADMIN" />
          </Suspense>
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  );
}
