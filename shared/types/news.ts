// ============================================================
// News types
// ============================================================

export interface NewsArticle {
  id: string;
  title: string;
  content: string;
  coverImageUrl?: string | null;
  isPublished: boolean;
  publishedAt?: string | null;
  author: { id: string; firstName: string; lastName: string };
  createdAt: string;
  updatedAt: string;
}

export interface CreateNewsRequest {
  title: string;
  content: string;
}

export interface UpdateNewsRequest {
  title?: string;
  content?: string;
}

export interface NewsQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  isPublished?: boolean;
}
