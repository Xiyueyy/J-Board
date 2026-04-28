import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function GlobalNotFound() {
  return (
    <main className="grid min-h-[100dvh] place-items-center px-4 py-10">
      <section className="surface-card w-full max-w-md space-y-4 rounded-xl p-6 text-center">
        <p className="text-xs font-medium tracking-wide text-primary">404</p>
        <h1 className="text-display text-2xl font-semibold">页面不存在</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          链接可能已失效，或者你没有访问该页面的权限。
        </p>
        <div className="flex flex-wrap justify-center gap-2.5">
          <Link href="/" className={buttonVariants({ size: "lg" })}>
            返回首页
          </Link>
          <Link href="/login" className={buttonVariants({ variant: "outline", size: "lg" })}>
            去登录
          </Link>
        </div>
      </section>
    </main>
  );
}
