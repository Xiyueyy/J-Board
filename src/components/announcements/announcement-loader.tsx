import { getVisibleAnnouncements } from "@/services/announcements";
import { AnnouncementPresenter } from "./announcement-presenter";

export async function AnnouncementLoader({
  userId,
  role,
}: {
  userId?: string;
  role?: "USER" | "ADMIN";
} = {}) {
  const announcements = await getVisibleAnnouncements({ userId, role });
  return <AnnouncementPresenter announcements={announcements} />;
}
