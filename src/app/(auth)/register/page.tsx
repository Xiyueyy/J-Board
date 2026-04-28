import type { Metadata } from "next";
import { getAppConfig } from "@/services/app-config";
import { RegisterPageClient } from "./register-page-client";

export const metadata: Metadata = {
  title: "注册",
  description: "创建 J-Board 新账户并开始订阅服务。",
};

export default async function RegisterPage() {
  const config = await getAppConfig();
  return <RegisterPageClient siteKey={config.turnstileSiteKey} />;
}
