import { get, post, patch, del } from '../client';
import type { Category, CreateCategoryRequest, UpdateCategoryRequest } from '@shared/types/category';

export const categoriesApi = {
  /** List categories. Pass includeAll=true for admin to see inactive ones too */
  list: (options?: { includeAll?: boolean; municipalityId?: string }) => {
    const params = new URLSearchParams();
    if (options?.includeAll) params.set('all', 'true');
    if (options?.municipalityId) params.set('municipalityId', options.municipalityId);
    const q = params.toString();
    return get<Category[]>(`/categories${q ? `?${q}` : ''}`);
  },

  getById: (id: string) =>
    get<Category>(`/categories/${id}`),

  create: (data: CreateCategoryRequest) =>
    post<Category>('/categories', data),

  update: (id: string, data: UpdateCategoryRequest) =>
    patch<Category>(`/categories/${id}`, data),

  activate: (id: string) =>
    post<Category>(`/categories/${id}/activate`),

  deactivate: (id: string) =>
    post<Category>(`/categories/${id}/deactivate`),

  remove: (id: string) =>
    del<{ message: string }>(`/categories/${id}`),
};
