import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { AccountPanel } from "./account-panel";
import { getAccountPageData } from "./account-data";
import { SiteNotice } from "./_components/site-notice";

export const metadata: Metadata = {
  title: "账户中心",
  description: "管理账户资料、安全设置与邀请码。",
};

export default async function AccountPage() {
  const session = await getServerSession(authOptions);
  const { user, siteNotice } = await getAccountPageData(session!.user.id);

  return (
    <PageShell>
      <PageHeader
        eyebrow="账户中心"
        title="个人资料与安全"
      />

      {siteNotice && <SiteNotice notice={siteNotice} />}
      <AccountPanel user={user} />
    </PageShell>
  );
}
