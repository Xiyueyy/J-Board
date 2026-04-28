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

export function LoginPageClient({ siteKey }: { siteKey?: string | null }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
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
      setError("邮箱或密码错误");
    } else {
      router.push("/");
      router.refresh();
    }
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
          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? "登录中..." : "登录"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          没有账户？{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            注册
          </Link>
        </p>
      </AuthCard>
    </AuthShell>
  );
}
