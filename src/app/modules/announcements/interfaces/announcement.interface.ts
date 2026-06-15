export interface CreateAnnouncementDto {
  title: string;
  content: string;
  image?: string | null;
  date?: string | null;
  isActive?: boolean;
}

export interface UpdateAnnouncementDto {
  title?: string;
  content?: string;
  image?: string | null;
  date?: string | null;
  isActive?: boolean;
}
