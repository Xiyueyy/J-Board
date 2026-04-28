"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function UserError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-md">
        <CardContent className="py-10 text-center space-y-5">
          <h1 className="text-xl font-semibold tracking-tight">出了点问题</h1>
          <p className="text-sm text-destructive">
            {error.message || "页面加载失败，请稍后重试。"}
          </p>
          <Button onClick={reset} className="h-10">重试</Button>
        </CardContent>
      </Card>
    </div>
  );
}
