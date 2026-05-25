// Re-export all API endpoint modules for convenient access
export { authApi } from './endpoints/auth';
export { municipalitiesApi } from './endpoints/municipalities';
export { complaintsApi } from './endpoints/complaints';
export { usersApi } from './endpoints/users';
export { rolesApi } from './endpoints/roles';
export { departmentsApi } from './endpoints/departments';
export type { DepartmentWithHead, DepartmentMember } from './endpoints/departments';
export { categoriesApi } from './endpoints/categories';
export { newsApi } from './endpoints/news';
export { notificationsApi } from './endpoints/notifications';
export { platformApi } from './endpoints/platform';
export { platformAnnouncementsApi } from './endpoints/platform-announcements';
export { tasksApi } from './endpoints/tasks';
export { transfersApi } from './endpoints/transfers';
export { helpRequestsApi } from './endpoints/help-requests';
export { auditApi } from './endpoints/audit';
export type { AuditEntry, AuditQuery } from './endpoints/audit';
export type {
  PlatformMunicipality,
  PlatformUser,
  PlatformStats,
  AuditLogEntry,
  CreateMunicipalityRequest,
} from './endpoints/platform';

// Re-export client utilities
export { ApiError, getFileUrl, configureAuth, downloadFile } from './client';
