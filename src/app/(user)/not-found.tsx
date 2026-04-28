import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function UserNotFound() {
  return (
    <section className="surface-card mx-auto w-full max-w-md space-y-4 rounded-xl p-6 text-center">
      <p className="text-xs font-medium tracking-wide text-primary">404</p>
      <h1 className="text-display text-2xl font-semibold">未找到该资源</h1>
      <p className="text-sm leading-6 text-muted-foreground">
        目标工单或订阅可能已删除，或你无权访问该内容。
      </p>
      <div className="flex flex-wrap justify-center gap-2.5">
        <Link href="/dashboard" className={buttonVariants({ size: "lg" })}>
          返回概览
        </Link>
        <Link href="/support" className={buttonVariants({ variant: "outline", size: "lg" })}>
          返回工单
        </Link>
      </div>
    </section>
  );
}
