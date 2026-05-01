import type { Metadata } from "next";
import { getAppConfig } from "@/services/app-config";
import { LoginPageClient } from "./login-page-client";

export const metadata: Metadata = {
  title: "登录",
  description: "登录 J-Board 账户并进入用户中心。",
};

type LoginPageProps = {
  searchParams?: Promise<{ error?: string | string[] }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const config = await getAppConfig();
  const params: { error?: string | string[] } = searchParams ? await searchParams : {};
  const initialErrorCode = Array.isArray(params.error) ? params.error[0] : params.error;

  return (
    <LoginPageClient
      siteKey={config.turnstileSiteKey}
      oauthEnabled={config.oauthEnabled}
      oauthButtonText={config.oauthButtonText}
      initialErrorCode={initialErrorCode}
    />
  );
}
