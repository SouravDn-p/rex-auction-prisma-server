export interface CreateBlogDto {
  title: string;
  imageUrls: string[];
  excerpt?: string | null;
  fullContent: string;
  tags?: string[];
}

export interface UpdateBlogDto {
  title?: string;
  imageUrls?: string[];
  excerpt?: string | null;
  fullContent?: string;
  tags?: string[];
}

export interface ListBlogsQuery {
  page?: number;
  limit?: number;
  tag?: string;
  authorId?: number;
  search?: string;
  isPublished?: boolean;
}

export interface GetBlogOptions {
  isAdmin?: boolean;
  authorId?: number;
}
