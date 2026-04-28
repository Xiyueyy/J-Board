import type { Metadata } from "next";
import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AnnouncementLoader } from "@/components/announcements/announcement-loader";
import { PageTransition } from "@/components/shared/page-transition";

export const metadata: Metadata = {
  title: {
    default: "登录与注册",
    template: "%s | J-Board",
  },
  description: "登录或注册 J-Board 账号。",
};

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (session) {
    redirect(session.user.role === "ADMIN" ? "/admin/dashboard" : "/dashboard");
  }
  return (
    <>
      <Suspense fallback={null}>
        <AnnouncementLoader />
      </Suspense>
      <PageTransition>{children}</PageTransition>
    </>
  );
}
