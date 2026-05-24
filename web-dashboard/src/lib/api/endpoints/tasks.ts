import { get, post, patch, del, getPaginated } from '../client';
import { buildQueryString } from '@/lib/utils';
import type {
  Task,
  CreateTaskRequest,
  UpdateTaskRequest,
  TaskQueryParams,
  TaskStatus,
} from '@shared/types/task';

export const tasksApi = {
  list: (params: TaskQueryParams = {}) =>
    getPaginated<Task>(`/tasks${buildQueryString(params as Record<string, unknown>)}`),

  getById: (id: string) => get<Task>(`/tasks/${id}`),

  create: (data: CreateTaskRequest) => post<Task>('/tasks', data),

  update: (id: string, data: UpdateTaskRequest) =>
    patch<Task>(`/tasks/${id}`, data),

  changeStatus: (id: string, status: TaskStatus, notes?: string) =>
    patch<Task>(`/tasks/${id}/status`, { status, notes }),

  assign: (id: string, assignedToId: string) =>
    post<Task>(`/tasks/${id}/assign`, { assignedToId }),

  remove: (id: string) => del<{ ok: true }>(`/tasks/${id}`),
};
