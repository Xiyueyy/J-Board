"use client";

import type { FormEvent } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TurnstileWidget } from "@/components/shared/turnstile-widget";
import { AuthCard, AuthErrorMessage, AuthShell } from "../_components/auth-shell";

const OAUTH_PROVIDER_ID = "custom-oauth";

const oauthErrorMessages: Record<string, string> = {
  OAuthEmailMissing: "OAuth 服务没有返回邮箱，无法绑定账户",
  OAuthEmailUnverified: "OAuth 服务返回的邮箱未验证，无法绑定账户",
  OAuthRegistrationDisabled: "该邮箱尚未注册，且当前站点未开放 OAuth 自动注册",
  OAuthInviteRequired: "该邮箱尚未注册，当前站点要求邀请码，无法通过 OAuth 自动创建账户",
  OAuthUserDisabled: "该账号已被禁用或封禁，无法登录",
  AccessDenied: "OAuth 登录被拒绝，请确认邮箱已注册或站点允许自动注册",
  OAuthSignin: "OAuth 登录初始化失败，请检查 OAuth 配置",
  OAuthCallback: "OAuth 回调失败，请检查回调地址、Client ID 和 Client Secret",
  OAuthCreateAccount: "OAuth 账户创建失败，请稍后重试",
};

export function LoginPageClient({
  siteKey,
  oauthEnabled,
  oauthButtonText,
  initialErrorCode,
}: {
  siteKey?: string | null;
  oauthEnabled?: boolean;
  oauthButtonText?: string | null;
  initialErrorCode?: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState(
    initialErrorCode ? oauthErrorMessages[initialErrorCode] ?? "登录失败，请稍后重试" : "",
  );
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (siteKey && !turnstileToken) {
      setError("请完成人机验证");
      return;
    }
    setLoading(true);
    setError("");
    const formData = new FormData(event.currentTarget);
    const result = await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      turnstileToken,
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setError(result.error === "EMAIL_NOT_VERIFIED" ? "邮箱尚未验证，请先查收验证邮件" : "邮箱或密码错误");
    } else {
      router.push("/");
      router.refresh();
    }
  }

  async function onOAuthLogin() {
    setOauthLoading(true);
    setError("");
    await signIn(OAUTH_PROVIDER_ID, { callbackUrl: "/" });
    setOauthLoading(false);
  }

  return (
    <AuthShell>
      <AuthCard title="J-Board" description="登录你的 JB面板账户">
        <form onSubmit={onSubmit} className="space-y-4">
          <AuthErrorMessage message={error} />
          <div className="space-y-2">
            <Label htmlFor="email">邮箱</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">密码</Label>
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          <TurnstileWidget siteKey={siteKey} onSuccess={setTurnstileToken} />
          <Button type="submit" className="w-full" size="lg" disabled={loading || oauthLoading}>
            {loading ? "登录中..." : "登录"}
          </Button>
        </form>
        {oauthEnabled && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              <span>或</span>
              <span className="h-px flex-1 bg-border" />
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              size="lg"
              onClick={onOAuthLogin}
              disabled={loading || oauthLoading}
            >
              {oauthLoading ? "跳转中..." : oauthButtonText || "使用 OAuth 登录"}
            </Button>
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
          <Link href="/forgot-password" className="font-medium text-primary hover:underline">
            忘记密码
          </Link>
          <span className="h-1 w-1 rounded-full bg-muted-foreground/30" aria-hidden />
          <span>
            没有账户？{" "}
            <Link href="/register" className="font-medium text-primary hover:underline">
              注册
            </Link>
          </span>
          {error === "邮箱尚未验证，请先查收验证邮件" && (
            <>
              <span className="h-1 w-1 rounded-full bg-muted-foreground/30" aria-hidden />
              <Link href="/verify-email-request" className="font-medium text-primary hover:underline">
                重发验证邮件
              </Link>
            </>
          )}
        </div>
      </AuthCard>
    </AuthShell>
  );
}
