import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function AdminNotFound() {
  return (
    <section className="surface-card mx-auto w-full max-w-md space-y-4 rounded-xl p-6 text-center">
      <p className="text-xs font-medium tracking-wide text-primary">404</p>
      <h1 className="text-display text-2xl font-semibold">目标数据不存在</h1>
      <p className="text-sm leading-6 text-muted-foreground">
        记录可能已被删除，或当前管理账号没有读取权限。
      </p>
      <div className="flex flex-wrap justify-center gap-2.5">
        <Link href="/admin/dashboard" className={buttonVariants({ size: "lg" })}>
          返回仪表盘
        </Link>
        <Link href="/admin/support" className={buttonVariants({ variant: "outline", size: "lg" })}>
          返回工单列表
        </Link>
      </div>
    </section>
  );
}
