import { ShieldCheck, UserRound } from "lucide-react";
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
import type { AccountPanelUser } from "../account-types";

type AccountFormAction = (formData: FormData) => void | Promise<void>;

interface AccountProfileCardProps {
  user: Pick<AccountPanelUser, "email" | "name">;
  isSaving: boolean;
  onSubmit: AccountFormAction;
}

export function AccountProfileCard({ user, isSaving, onSubmit }: AccountProfileCardProps) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <UserRound className="size-4" />
          </span>
          <div className="min-w-0 space-y-1">
            <CardTitle>账户资料</CardTitle>
            <CardDescription>让昵称和登录邮箱保持清晰，减少账号识别成本。</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form action={onSubmit} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
              <Label htmlFor="name">昵称</Label>
              <Input id="name" name="name" defaultValue={user.name ?? ""} required />
            </div>
            <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="email">邮箱</Label>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[0.68rem] font-semibold text-emerald-700 dark:text-emerald-300">
                  <ShieldCheck className="size-3" /> 已绑定
                </span>
              </div>
              <Input id="email" value={user.email} disabled />
            </div>
          </div>
          <Button type="submit" size="lg" disabled={isSaving} className="w-full sm:w-auto">
            {isSaving ? "保存中..." : "保存资料"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
