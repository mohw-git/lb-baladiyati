export type TaskStatus = 'NEW' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE' | 'CANCELLED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface TaskUserRef {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl?: string | null;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  completedAt: string | null;
  departmentId: string;
  department?: { id: string; name: string };
  assignedToId: string | null;
  assignedTo?: TaskUserRef | null;
  createdById: string;
  createdBy?: TaskUserRef;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskRequest {
  departmentId: string;
  title: string;
  description?: string;
  priority?: TaskPriority;
  dueDate?: string;
  assignedToId?: string;
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  priority?: TaskPriority;
  dueDate?: string;
}

export interface TaskQueryParams {
  page?: number;
  limit?: number;
  status?: TaskStatus;
  priority?: TaskPriority;
  departmentId?: string;
  assignedToId?: string;
  myAssignments?: boolean;
  myTasks?: boolean;
  q?: string;
}
