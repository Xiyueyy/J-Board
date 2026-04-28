import { CalendarDays, Sparkles, TicketCheck, UsersRound } from "lucide-react";
import { CopyButton } from "@/components/shared/copy-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface AccountInviteCardProps {
  inviteCode: string | null;
  invitedUsersCount: number;
  inviteRewardCount: number;
  inviteRewardAmount: number;
  createdAt: string;
  isLoading: boolean;
  onGenerate: () => void;
}

export function AccountInviteCard({
  inviteCode,
  invitedUsersCount,
  inviteRewardCount,
  inviteRewardAmount,
  createdAt,
  isLoading,
  onGenerate,
}: AccountInviteCardProps) {
  return (
    <Card className="xl:sticky xl:top-6">
      <CardHeader className="pb-1">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <TicketCheck className="size-4" />
          </span>
          <div className="min-w-0 space-y-1">
            <CardTitle>邀请好友</CardTitle>
            <CardDescription>把专属邀请码分享给新用户，注册时自动完成基础校验。</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-lg border border-primary/12 bg-primary/[0.04] p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium tracking-wide text-primary">
            <Sparkles className="size-3" /> INVITE TOKEN
          </div>
          <div className="space-y-3">
            <Input
              value={inviteCode ?? "暂未生成"}
              disabled
              className="font-mono text-base tracking-[0.18em]"
            />
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              {inviteCode && <CopyButton text={inviteCode} />}
              <Button
                type="button"
                variant={inviteCode ? "outline" : "default"}
                onClick={onGenerate}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? "处理中..." : inviteCode ? "重新生成" : "生成邀请码"}
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <UsersRound className="size-3.5" /> 已邀请
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{invitedUsersCount}</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <Sparkles className="size-3.5" /> 已到账奖励
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums">¥{inviteRewardAmount.toFixed(2)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{inviteRewardCount} 笔记录</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-3 sm:col-span-2 xl:col-span-1 2xl:col-span-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <CalendarDays className="size-3.5" /> 注册时间
            </div>
            <p className="mt-2 text-sm font-medium leading-6">{createdAt}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
