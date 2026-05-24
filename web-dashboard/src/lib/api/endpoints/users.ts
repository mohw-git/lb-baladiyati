import { get, post, patch, del, getPaginated } from '../client';
import { buildQueryString } from '@/lib/utils';
import type { User, CreateUserRequest, UpdateUserRequest, UserQueryParams, AssignRoleRequest } from '@shared/types/user';

export const usersApi = {
  list: (params: UserQueryParams = {}) =>
    getPaginated<User>(`/users${buildQueryString(params as Record<string, unknown>)}`),

  getById: (id: string) =>
    get<User>(`/users/${id}`),

  create: (data: CreateUserRequest) =>
    post<User>('/users', data),

  update: (id: string, data: UpdateUserRequest) =>
    patch<User>(`/users/${id}`, data),

  assignRole: (userId: string, data: AssignRoleRequest) =>
    post<{ message: string }>(`/users/${userId}/roles`, data),

  removeRole: (userId: string, roleId: string) =>
    del<{ message: string }>(`/users/${userId}/roles/${roleId}`),
};
