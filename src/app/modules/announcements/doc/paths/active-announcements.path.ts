export const activeAnnouncementsPath = {
  get: {
    summary: "Get active announcements",
    description: "Returns recent active announcements for homepage banners.",
    tags: ["Announcements"],
    responses: {
      200: { description: "Active announcements retrieved" },
    },
  },
};
