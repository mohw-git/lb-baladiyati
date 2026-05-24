import { get, post, patch, del, postFormData, getPaginated } from '../client';
import { buildQueryString } from '@/lib/utils';
import type { NewsArticle, CreateNewsRequest, UpdateNewsRequest, NewsQueryParams } from '@shared/types/news';

export const newsApi = {
  list: (params: NewsQueryParams = {}) =>
    getPaginated<NewsArticle>(`/news${buildQueryString(params as Record<string, unknown>)}`),

  getById: (id: string) =>
    get<NewsArticle>(`/news/${id}`),

  create: (data: CreateNewsRequest, coverImage?: File) => {
    const formData = new FormData();
    formData.append('title', data.title);
    formData.append('content', data.content);
    if (coverImage) formData.append('coverImage', coverImage);
    return postFormData<NewsArticle>('/news', formData);
  },

  update: (id: string, data: UpdateNewsRequest, coverImage?: File) => {
    const formData = new FormData();
    if (data.title) formData.append('title', data.title);
    if (data.content) formData.append('content', data.content);
    if (coverImage) formData.append('coverImage', coverImage);
    return postFormData<NewsArticle>(`/news/${id}`, formData, { method: 'PATCH' });
  },

  publish: (id: string) =>
    post<NewsArticle>(`/news/${id}/publish`),

  unpublish: (id: string) =>
    post<NewsArticle>(`/news/${id}/unpublish`),

  remove: (id: string) =>
    del<{ message: string }>(`/news/${id}`),
};
