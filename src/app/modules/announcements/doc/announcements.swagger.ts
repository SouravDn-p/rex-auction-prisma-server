import { activeAnnouncementsPath } from "./paths/active-announcements.path.ts";
import { createAnnouncementPath } from "./paths/create-announcement.path.ts";
import { deleteAnnouncementPath } from "./paths/delete-announcement.path.ts";
import { getAnnouncementPath } from "./paths/get-announcement.path.ts";
import { listAnnouncementsPath } from "./paths/list-announcements.path.ts";
import { updateAnnouncementPath } from "./paths/update-announcement.path.ts";

export const announcementsPaths = {
  "/announcements": {
    ...listAnnouncementsPath,
    ...createAnnouncementPath,
  },
  "/announcements/active": activeAnnouncementsPath,
  "/announcements/{id}": {
    ...getAnnouncementPath,
    ...updateAnnouncementPath,
    ...deleteAnnouncementPath,
  },
};
