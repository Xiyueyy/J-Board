import type { Metadata } from "next";
import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { UserSidebar } from "@/components/user/sidebar";
import { UserMobileNav } from "@/components/user/mobile-nav";
import { AnnouncementLoader } from "@/components/announcements/announcement-loader";
import { getUnreadNotificationCount } from "./notifications/notifications-data";
import { PageTransition } from "@/components/shared/page-transition";

export const metadata: Metadata = {
  title: {
    default: "用户中心",
    template: "%s | J-Board",
  },
  description: "管理套餐、订单、订阅和账户信息。",
};

export default async function UserLayout({
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

  const userName = session.user.name || session.user.email || "";
  const unreadCount = await getUnreadNotificationCount(session.user.id);

  return (
    <div className="flex h-[100dvh] overflow-hidden p-0 md:p-3">
      <div className="hidden shrink-0 md:flex">
        <UserSidebar userName={userName} unreadCount={unreadCount} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden md:pl-3">
        <UserMobileNav userName={userName} unreadCount={unreadCount} />
        <main className="flex-1 overflow-auto px-3 py-4 sm:px-5 sm:py-6 md:pt-0 lg:px-7 lg:pb-7">
          <Suspense fallback={null}>
            <AnnouncementLoader userId={session.user.id} role="USER" />
          </Suspense>
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  );
}
