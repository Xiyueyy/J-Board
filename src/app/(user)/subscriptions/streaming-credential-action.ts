"use server";

import { decrypt } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/require-auth";

export async function revealStreamingCredential(subscriptionId: string) {
  const session = await requireAuth();
  const subscription = await prisma.userSubscription.findFirst({
    where: {
      id: subscriptionId,
      userId: session.user.id,
      status: "ACTIVE",
    },
    select: {
      streamingSlot: {
        select: {
          service: {
            select: {
              credentials: true,
              description: true,
              name: true,
            },
          },
        },
      },
    },
  });

  const service = subscription?.streamingSlot?.service;
  if (!service) {
    throw new Error("当前订阅没有可用的流媒体凭据");
  }

  return {
    name: service.name,
    description: service.description,
    credentials: decrypt(service.credentials),
  };
}
