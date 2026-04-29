import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, PageShell, SectionHeader } from "@/components/shared/page-shell";
import { DataTableShell } from "@/components/admin/data-table-shell";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeadCell,
  DataTableHeaderRow,
  DataTableRow,
} from "@/components/shared/data-table";
import {
  OrderStatusBadge,
  SubscriptionStatusBadge,
  SubscriptionTypeBadge,
  UserRoleBadge,
  UserStatusBadge,
  orderKindLabels,
} from "@/components/shared/domain-badges";
import { StatusBadge, type StatusTone } from "@/components/shared/status-badge";
import {
  SupportTicketPriorityBadge,
  SupportTicketStatusBadge,
} from "@/components/support/ticket-badges";
import { formatBytes, formatDate, formatDateShort } from "@/lib/utils";
import { reasonLabel } from "@/services/subscription-risk-review";
import { UserActions } from "../user-actions";
import { getAdminUserDetail } from "./user-detail-data";

export const metadata: Metadata = {
  title: "用户详情",
  description: "查看用户资料、订阅、订单、工单和风控记录。",
};

function MetricCard({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-lg border border-border/70 bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-2 min-h-7 break-words text-xl font-semibold tracking-[-0.02em]">{value}</div>
      {hint && <div className="mt-1 text-xs leading-5 text-muted-foreground">{hint}</div>}
    </div>
  );
}

function reviewStatusLabel(status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED") {
  if (status === "RESOLVED") return "已解决";
  if (status === "ACKNOWLEDGED") return "已确认";
  return "待处理";
}

function reviewStatusTone(status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED"): StatusTone {
  if (status === "RESOLVED") return "success";
  if (status === "ACKNOWLEDGED") return "info";
  return "warning";
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getAdminUserDetail(id);

  if (!data) {
    notFound();
  }

  const { user, subscriptions, orders, riskEvents, supportTickets } = data;

  return (
    <PageShell>
      <PageHeader
        eyebrow="用户详情"
        title={user.email}
        description={user.name || "未设置昵称"}
        actions={<UserActions user={user} />}
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="账号状态"
          value={(
            <span className="flex flex-wrap gap-2">
              <UserStatusBadge status={user.status} />
              <UserRoleBadge role={user.role} />
            </span>
          )}
          hint={user.emailVerifiedAt ? "邮箱已验证" : "邮箱未验证"}
        />
        <MetricCard label="订阅" value={user._count.subscriptions} hint="用户持有的全部订阅" />
        <MetricCard label="订单" value={user._count.orders} hint="历史订单数量" />
        <MetricCard label="工单" value={user._count.supportTickets} hint="售后沟通记录" />
        <MetricCard label="注册时间" value={formatDateShort(user.createdAt)} hint={user.invitedBy ? "邀请人：" + user.invitedBy.email : "非邀请注册或邀请人已删除"} />
      </section>

      <section className="rounded-lg border border-border/70 bg-card p-4 text-sm leading-6">
        <SectionHeader
          title="账号资料"
          description="用于风控判断时快速确认用户基础信息。"
          actions={<Link href={"/admin/subscription-risk?q=" + encodeURIComponent(user.email)} className="text-sm font-medium text-primary hover:underline">查看该用户风控</Link>}
        />
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">用户 ID</p>
            <p className="mt-1 break-all font-mono text-xs">{user.id}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">邀请码</p>
            <p className="mt-1 break-all font-mono text-xs">{user.inviteCode || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">注册时间</p>
            <p className="mt-1">{formatDate(user.createdAt)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">更新时间</p>
            <p className="mt-1">{formatDate(user.updatedAt)}</p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeader title="订阅" description="最近创建的订阅与当前状态。" />
        <DataTableShell isEmpty={subscriptions.length === 0} emptyTitle="暂无订阅" emptyDescription="这个用户还没有订阅记录。">
          <DataTable aria-label="用户订阅" className="min-w-[820px]">
            <DataTableHead>
              <DataTableHeaderRow>
                <DataTableHeadCell>套餐</DataTableHeadCell>
                <DataTableHeadCell>类型</DataTableHeadCell>
                <DataTableHeadCell>状态</DataTableHeadCell>
                <DataTableHeadCell>流量</DataTableHeadCell>
                <DataTableHeadCell>到期</DataTableHeadCell>
                <DataTableHeadCell>创建时间</DataTableHeadCell>
              </DataTableHeaderRow>
            </DataTableHead>
            <DataTableBody>
              {subscriptions.map((subscription) => (
                <DataTableRow key={subscription.id}>
                  <DataTableCell>
                    <Link href={"/admin/subscriptions/" + subscription.id} className="font-medium hover:underline">
                      {subscription.plan.name}
                    </Link>
                  </DataTableCell>
                  <DataTableCell><SubscriptionTypeBadge type={subscription.plan.type} /></DataTableCell>
                  <DataTableCell><SubscriptionStatusBadge status={subscription.status} /></DataTableCell>
                  <DataTableCell className="text-xs text-muted-foreground">
                    {formatBytes(subscription.trafficUsed)} / {subscription.trafficLimit ? formatBytes(subscription.trafficLimit) : "不限"}
                  </DataTableCell>
                  <DataTableCell className="whitespace-nowrap text-muted-foreground">{formatDateShort(subscription.endDate)}</DataTableCell>
                  <DataTableCell className="whitespace-nowrap text-muted-foreground">{formatDateShort(subscription.createdAt)}</DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        </DataTableShell>
      </section>

      <section className="space-y-3">
        <SectionHeader title="近期风控" description="这个用户最近触发的订阅访问风控事件。" />
        <DataTableShell isEmpty={riskEvents.length === 0} emptyTitle="暂无风控事件" emptyDescription="目前没有该用户的订阅风控记录。">
          <DataTable aria-label="用户风控事件" className="min-w-[760px]">
            <DataTableHead>
              <DataTableHeaderRow>
                <DataTableHeadCell>时间</DataTableHeadCell>
                <DataTableHeadCell>判定</DataTableHeadCell>
                <DataTableHeadCell>地区/IP</DataTableHeadCell>
                <DataTableHeadCell>状态</DataTableHeadCell>
              </DataTableHeaderRow>
            </DataTableHead>
            <DataTableBody>
              {riskEvents.map((event) => (
                <DataTableRow key={event.id}>
                  <DataTableCell className="whitespace-nowrap text-muted-foreground">{formatDate(event.createdAt)}</DataTableCell>
                  <DataTableCell>
                    <div className="space-y-2">
                      <StatusBadge tone={event.level === "SUSPENDED" ? "danger" : "warning"}>{reasonLabel(event.reason)}</StatusBadge>
                      <p className="max-w-lg text-xs leading-5 text-muted-foreground">{event.message}</p>
                    </div>
                  </DataTableCell>
                  <DataTableCell className="text-xs text-muted-foreground">
                    <p className="font-mono text-foreground">{event.ip || "未知 IP"}</p>
                    <p>城市 {event.cityCount} · 省/地区 {event.regionCount} · 国家 {event.countryCount}</p>
                  </DataTableCell>
                  <DataTableCell>
                    <StatusBadge tone={reviewStatusTone(event.reviewStatus)}>{reviewStatusLabel(event.reviewStatus)}</StatusBadge>
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        </DataTableShell>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-3">
          <SectionHeader title="近期订单" description="最近的购买、续费和增流量订单。" />
          <DataTableShell isEmpty={orders.length === 0} emptyTitle="暂无订单" emptyDescription="这个用户还没有订单记录。">
            <DataTable aria-label="用户订单" className="min-w-[680px]">
              <DataTableHead>
                <DataTableHeaderRow>
                  <DataTableHeadCell>套餐</DataTableHeadCell>
                  <DataTableHeadCell>类型</DataTableHeadCell>
                  <DataTableHeadCell>金额</DataTableHeadCell>
                  <DataTableHeadCell>状态</DataTableHeadCell>
                  <DataTableHeadCell>时间</DataTableHeadCell>
                </DataTableHeaderRow>
              </DataTableHead>
              <DataTableBody>
                {orders.map((order) => (
                  <DataTableRow key={order.id}>
                    <DataTableCell className="max-w-52 truncate font-medium">{order.plan.name}</DataTableCell>
                    <DataTableCell>{orderKindLabels[order.kind]}</DataTableCell>
                    <DataTableCell className="font-mono">¥{Number(order.amount).toFixed(2)}</DataTableCell>
                    <DataTableCell><OrderStatusBadge status={order.status} /></DataTableCell>
                    <DataTableCell className="whitespace-nowrap text-muted-foreground">{formatDateShort(order.createdAt)}</DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </DataTableShell>
        </div>

        <div className="space-y-3">
          <SectionHeader title="近期工单" description="用户与客服之间的最近沟通。" />
          <DataTableShell isEmpty={supportTickets.length === 0} emptyTitle="暂无工单" emptyDescription="这个用户还没有提交工单。">
            <DataTable aria-label="用户工单" className="min-w-[680px]">
              <DataTableHead>
                <DataTableHeaderRow>
                  <DataTableHeadCell>标题</DataTableHeadCell>
                  <DataTableHeadCell>状态</DataTableHeadCell>
                  <DataTableHeadCell>优先级</DataTableHeadCell>
                  <DataTableHeadCell>更新</DataTableHeadCell>
                </DataTableHeaderRow>
              </DataTableHead>
              <DataTableBody>
                {supportTickets.map((ticket) => (
                  <DataTableRow key={ticket.id}>
                    <DataTableCell>
                      <Link href={"/admin/support/" + ticket.id} className="max-w-72 truncate font-medium hover:underline">
                        {ticket.subject}
                      </Link>
                    </DataTableCell>
                    <DataTableCell><SupportTicketStatusBadge status={ticket.status} /></DataTableCell>
                    <DataTableCell><SupportTicketPriorityBadge priority={ticket.priority} /></DataTableCell>
                    <DataTableCell className="whitespace-nowrap text-muted-foreground">{formatDateShort(ticket.updatedAt)}</DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </DataTableShell>
        </div>
      </section>
    </PageShell>
  );
}
