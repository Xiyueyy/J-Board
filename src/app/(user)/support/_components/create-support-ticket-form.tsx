"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { createSupportTicket } from "@/actions/user/support";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const ATTACHMENT_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/avif";

export function CreateSupportTicketForm() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} size="lg">
        <Plus className="size-4" />
        新建工单
      </Button>
    );
  }

  return (
    <form
      id="new-ticket"
      action={createSupportTicket}
      className="surface-card space-y-5 rounded-[2rem] p-5 sm:p-6"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">新建工单</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="subject">标题</Label>
          <Input id="subject" name="subject" placeholder="一句话描述遇到的问题" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="priority">优先级</Label>
          <select
            id="priority"
            name="priority"
            defaultValue="NORMAL"
            className="h-11 w-full px-3 text-sm outline-none"
          >
            <option value="LOW">低</option>
            <option value="NORMAL">普通</option>
            <option value="HIGH">高</option>
            <option value="URGENT">紧急</option>
          </select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="category">分类</Label>
        <Input id="category" name="category" placeholder="例如：支付 / 节点 / 流媒体 / 账户" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="body">问题描述</Label>
        <Textarea id="body" name="body" rows={5} placeholder="补充问题背景、错误提示或你已经尝试过的步骤" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="attachments">附件（最多 3 张，仅支持图片，每张不超过 3MB）</Label>
        <Input
          id="attachments"
          name="attachments"
          type="file"
          multiple
          accept={ATTACHMENT_ACCEPT}
        />
      </div>
      <Button type="submit" size="lg">提交工单</Button>
    </form>
  );
}
