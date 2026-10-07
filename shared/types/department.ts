// ============================================================
// Department types
// ============================================================

export interface Department {
  id: string;
  name: string;
  nameAr?: string | null;
  nameFr?: string | null;
  description?: string | null;
  descriptionAr?: string | null;
  descriptionFr?: string | null;
  createdAt: string;
}

export interface CreateDepartmentRequest {
  name: string;
  nameAr?: string;
  nameFr?: string;
  description?: string;
  descriptionAr?: string;
  descriptionFr?: string;
}

export interface UpdateDepartmentRequest {
  name?: string;
  nameAr?: string;
  nameFr?: string;
  description?: string;
  descriptionAr?: string;
  descriptionFr?: string;
}

export type DepartmentHealth = 'healthy' | 'elevated' | 'overloaded';

/** Operational row for Departments Overview and dashboard workload. */
export interface DepartmentWorkloadRow {
  id: string;
  name: string;
  nameAr?: string | null;
  nameFr?: string | null;
  head?: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    avatarUrl?: string | null;
    isActive?: boolean;
  } | null;
  staffCount: number;
  activeComplaints: number;
  overdueComplaints: number;
  pendingTransfersIn: number;
  /** Present only for municipality-wide viewers (Admin manage access). */
  pendingTransfersOut?: number;
  healthScore: number;
  health: DepartmentHealth;
}
