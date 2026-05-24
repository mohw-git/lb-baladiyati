import { get, post, patch, del } from '../client';
import type { Category, CreateCategoryRequest, UpdateCategoryRequest } from '@shared/types/category';

export const categoriesApi = {
  /** List categories. Pass includeAll=true for admin to see inactive ones too */
  list: (includeAll = false) =>
    get<Category[]>(`/categories${includeAll ? '?all=true' : ''}`),

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
