import { get, post, patch, put, del } from '../client';
import type { Role, Permission, CreateRoleRequest, UpdateRoleRequest, SetPermissionsRequest } from '@shared/types/role';

export const rolesApi = {
  list: () =>
    get<Role[]>('/roles'),

  getById: (id: string) =>
    get<Role>(`/roles/${id}`),

  create: (data: CreateRoleRequest) =>
    post<Role>('/roles', data),

  update: (id: string, data: UpdateRoleRequest) =>
    patch<Role>(`/roles/${id}`, data),

  setPermissions: (id: string, data: SetPermissionsRequest) =>
    put<Role>(`/roles/${id}/permissions`, data),

  remove: (id: string) =>
    del<{ message: string }>(`/roles/${id}`),

  listPermissions: () =>
    get<Permission[]>('/roles/permissions'),
};
