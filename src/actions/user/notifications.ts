"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/require-auth";
import {
  deleteNotification,
  deleteReadNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/services/notifications";

export async function markNotificationAsRead(notificationId: string) {
  const session = await requireAuth();
  await markNotificationRead(notificationId, session.user.id);
  revalidatePath("/notifications");
}

export async function markEveryNotificationAsRead() {
  const session = await requireAuth();
  await markAllNotificationsRead(session.user.id);
  revalidatePath("/notifications");
}

export async function removeNotification(notificationId: string) {
  const session = await requireAuth();
  await deleteNotification(notificationId, session.user.id);
  revalidatePath("/notifications");
}

export async function removeReadNotifications() {
  const session = await requireAuth();
  await deleteReadNotifications(session.user.id);
  revalidatePath("/notifications");
}
