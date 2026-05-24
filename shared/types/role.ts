// ============================================================
// Role & Permission types
// ============================================================

export interface Permission {
  id: string;
  key: string;
  name: string;
  module: string;
}

export interface Role {
  id: string;
  name: string;
  nameAr?: string | null;
  nameFr?: string | null;
  description?: string | null;
  descriptionAr?: string | null;
  descriptionFr?: string | null;
  isSystem: boolean;
  isSystemManaged?: boolean;
  /** Discord-style hierarchy priority (higher = stronger). Multiple roles may share a level. */
  priority?: number;
  permissions: Permission[];
  createdAt: string;
}

export interface RoleSummary {
  id: string;
  name: string;
  nameAr?: string | null;
  nameFr?: string | null;
  description?: string | null;
  isSystem: boolean;
  priority?: number;
  permissionCount?: number;
  userCount?: number;
}

export interface CreateRoleRequest {
  name: string;
  nameAr?: string;
  nameFr?: string;
  description?: string;
  descriptionAr?: string;
  descriptionFr?: string;
  priority?: number;
  permissionIds?: string[];
}

export interface UpdateRoleRequest {
  name?: string;
  nameAr?: string;
  nameFr?: string;
  description?: string;
  descriptionAr?: string;
  descriptionFr?: string;
  priority?: number;
}

export interface SetPermissionsRequest {
  permissionIds: string[];
}
