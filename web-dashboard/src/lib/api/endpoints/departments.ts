import { get, post, patch, put, del } from '../client';
import type { Department, CreateDepartmentRequest, UpdateDepartmentRequest } from '@shared/types/department';

export interface DepartmentWithHead extends Department {
  headUserId?: string | null;
  head?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl: string | null;
    isActive: boolean;
  } | null;
  _count?: {
    users: number;
    complaints: number;
  };
}

export const departmentsApi = {
  list: () => get<DepartmentWithHead[]>('/departments'),

  getById: (id: string) => get<DepartmentWithHead>(`/departments/${id}`),

  create: (data: CreateDepartmentRequest) =>
    post<Department>('/departments', data),

  update: (id: string, data: UpdateDepartmentRequest) =>
    patch<Department>(`/departments/${id}`, data),

  remove: (id: string) => del<{ message: string }>(`/departments/${id}`),

  setHead: (id: string, userId: string) =>
    put<{ ok: true; newHeadEmail: string }>(`/departments/${id}/head`, { userId }),

  vacateHead: (id: string) =>
    del<{ ok: true; alreadyVacant?: boolean }>(`/departments/${id}/head`),

  listMembers: (id: string) =>
    get<{
      department: { id: string; name: string; headUserId: string | null };
      members: DepartmentMember[];
    }>(`/departments/${id}/members`),

  addMember: (id: string, email: string) =>
    post<{ ok: true; userId: string; email: string; alreadyMember?: boolean }>(
      `/departments/${id}/members`,
      { email },
    ),

  removeMember: (id: string, userId: string) =>
    del<{ ok: true }>(`/departments/${id}/members/${userId}`),
};

export interface DepartmentMember {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  isActive: boolean;
  roles: string[];
  isHead: boolean;
}
