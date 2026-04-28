import { LockKeyhole, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AccountFormAction = (formData: FormData) => void | Promise<void>;

interface AccountPasswordCardProps {
  email: string;
  isSaving: boolean;
  onSubmit: AccountFormAction;
}

export function AccountPasswordCard({ email, isSaving, onSubmit }: AccountPasswordCardProps) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300">
            <LockKeyhole className="size-4" />
          </span>
          <div className="min-w-0 space-y-1">
            <CardTitle>安全密码</CardTitle>
            <CardDescription>建议使用 6 位以上强密码，修改后请在常用设备重新保存。</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form id="account-password-form" action={onSubmit} className="space-y-5">
          <input type="email" name="username" value={email} autoComplete="username" readOnly hidden />
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
              <Label htmlFor="currentPassword">当前密码</Label>
              <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required />
            </div>
            <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
              <Label htmlFor="newPassword">新密码</Label>
              <Input id="newPassword" name="newPassword" type="password" minLength={6} autoComplete="new-password" required />
            </div>
            <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
              <Label htmlFor="confirmPassword">确认新密码</Label>
              <Input id="confirmPassword" name="confirmPassword" type="password" minLength={6} autoComplete="new-password" required />
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="inline-flex items-center gap-2 text-xs leading-5 text-muted-foreground">
              <ShieldCheck className="size-3.5 text-primary" /> 密码更新不会影响当前订单和订阅。
            </p>
            <Button type="submit" size="lg" disabled={isSaving} className="w-full sm:w-auto">
              {isSaving ? "更新中..." : "更新密码"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
