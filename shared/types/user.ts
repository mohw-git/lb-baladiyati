// ============================================================
// User management types
// ============================================================

export type UserCreatedVia =
  | 'SELF_REGISTRATION'
  | 'ADMIN_PROVISIONED'
  | 'PLATFORM_PROVISIONED'
  | 'PLATFORM_SEEDED';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  isActive: boolean;
  department?: { id: string; name: string } | null;
  roles: { id: string; name: string; priority?: number }[];
  /** Maximum priority across all assigned roles (Discord-style hierarchy rank). */
  effectiveRank?: number;
  createdVia?: UserCreatedVia;
  verificationStatus?: string;
  /** Server-computed: public signup / citizen-only accounts. */
  isProtectedCitizen?: boolean;
  createdAt: string;
}

export interface CreateUserRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  departmentId?: string;
  /** At least one staff role (excludes Citizen / positional roles). */
  roleIds?: string[];
}

export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
  departmentId?: string;
  isActive?: boolean;
}

export interface UserQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  departmentId?: string;
  isActive?: boolean;
  /** Exclude users whose only role is "Citizen" (use for assignment dropdowns) */
  excludeCitizens?: boolean;
  /** Include self-registered citizens in the admin /users list (default: false). */
  includeCitizens?: boolean;
  /** Show ONLY citizens (users with the Citizen role). Used by the citizens management tab. */
  onlyCitizens?: boolean;
  roleId?: string;
}

export interface AssignRoleRequest {
  roleId: string;
}
