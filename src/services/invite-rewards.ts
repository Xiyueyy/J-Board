import type { Order, User } from "@prisma/client";
import { prisma, type DbClient } from "@/lib/prisma";
import { getAppConfig } from "@/services/app-config";
import { createNotification } from "@/services/notifications";
import { roundMoney } from "@/services/commerce";

export async function issueInviteRewardForOrder(
  order: Order & { user: User },
  db: DbClient = prisma,
) {
  if (!order.user.invitedById || order.status !== "PAID") return;

  const config = await getAppConfig(db);
  if (!config.inviteRewardEnabled) return;

  const inviter = await db.user.findUnique({
    where: { id: order.user.invitedById },
    select: { id: true, email: true },
  });
  if (!inviter) return;

  const rate = Number(config.inviteRewardRate ?? 0);
  const rewardAmount = rate > 0 ? roundMoney(Number(order.amount) * (rate / 100)) : 0;
  let couponCode: string | null = null;

  if (config.inviteRewardCouponId) {
    const coupon = await db.coupon.findUnique({
      where: { id: config.inviteRewardCouponId },
      select: { id: true, code: true, isActive: true },
    });
    if (coupon?.isActive) {
      couponCode = coupon.code;
      await db.couponGrant.create({
        data: {
          couponId: coupon.id,
          userId: inviter.id,
          source: "invite_reward",
          sourceOrderId: order.id,
        },
      });
    }
  }

  if (rewardAmount <= 0 && !couponCode) return;

  const ledger = await db.inviteRewardLedger.upsert({
    where: {
      orderId_inviterId: {
        orderId: order.id,
        inviterId: inviter.id,
      },
    },
    create: {
      inviterId: inviter.id,
      inviteeId: order.userId,
      orderId: order.id,
      rewardAmount,
      couponCode,
    },
    update: {
      rewardAmount,
      couponCode,
      status: "ISSUED",
    },
  });

  await createNotification(
    {
      userId: inviter.id,
      type: "SYSTEM",
      level: "SUCCESS",
      title: "邀请奖励已到账",
      body: couponCode
        ? `你的好友完成了订阅，奖励券 ${couponCode} 已放入你的账户。`
        : `你的好友完成了订阅，本次邀请奖励 ¥${rewardAmount.toFixed(2)} 已记录。`,
      link: "/account",
      dedupeKey: `invite-reward:${ledger.id}`,
    },
    db,
  );
}
