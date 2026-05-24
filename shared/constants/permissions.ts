/** All permission keys — mirrors backend permissions.constants.ts exactly */
export const PERMISSIONS = {
  // Complaints (12)
  COMPLAINT_CREATE: 'complaint.create',
  COMPLAINT_VIEW_OWN: 'complaint.view_own',
  COMPLAINT_VIEW_ALL: 'complaint.view_all',
  COMPLAINT_VIEW_ASSIGNED: 'complaint.view_assigned',
  COMPLAINT_VIEW_DEPARTMENT: 'complaint.view_department', // HOD sees all in their department
  COMPLAINT_ASSIGN: 'complaint.assign',
  COMPLAINT_CHANGE_STATUS: 'complaint.change_status',
  COMPLAINT_UPLOAD_ATTACHMENT: 'complaint.upload_attachment',
  COMPLAINT_VERIFY: 'complaint.verify',           // Supervisor verifies work completion
  COMPLAINT_APPROVE: 'complaint.approve',         // HOD approves closure
  COMPLAINT_REJECT: 'complaint.reject',           // Can reject complaints
  COMPLAINT_SET_PRIORITY: 'complaint.set_priority', // Can set priority/SLA

  // Categories (3)
  CATEGORY_CREATE: 'category.create',
  CATEGORY_UPDATE: 'category.update',
  CATEGORY_DELETE: 'category.delete',

  // Departments (3)
  DEPARTMENT_CREATE: 'department.create',
  DEPARTMENT_UPDATE: 'department.update',
  DEPARTMENT_DELETE: 'department.delete',

  // Users (5)
  USER_VIEW_ALL: 'user.view_all',
  USER_VIEW_DEPARTMENT: 'user.view_department', // HOD sees users in their department
  USER_CREATE: 'user.create',
  USER_UPDATE: 'user.update',
  USER_ASSIGN_ROLE: 'user.assign_role',

  // Roles (5)
  ROLE_VIEW: 'role.view',
  ROLE_CREATE: 'role.create',
  ROLE_UPDATE: 'role.update',
  ROLE_DELETE: 'role.delete',
  ROLE_MANAGE_PERMISSIONS: 'role.manage_permissions',

  // News (5)
  NEWS_VIEW_ALL: 'news.view_all',
  NEWS_CREATE: 'news.create',
  NEWS_UPDATE: 'news.update',
  NEWS_DELETE: 'news.delete',
  NEWS_PUBLISH: 'news.publish',

  // KYC (4)
  KYC_SUBMIT: 'kyc.submit',
  KYC_VIEW_OWN: 'kyc.view_own',
  KYC_VIEW_ALL: 'kyc.view_all',
  KYC_REVIEW: 'kyc.review',

  // Municipality (1)
  MUNICIPALITY_UPDATE: 'municipality.update',

  // Reports (2) - for dashboards
  REPORT_VIEW_DEPARTMENT: 'report.view_department',
  REPORT_VIEW_ALL: 'report.view_all',

  // Internal Tasks (8)
  TASK_VIEW_ALL: 'task.view_all',
  TASK_VIEW_DEPARTMENT: 'task.view_department',
  TASK_VIEW_ASSIGNED: 'task.view_assigned',
  TASK_CREATE: 'task.create',
  TASK_ASSIGN: 'task.assign',
  TASK_UPDATE: 'task.update',
  TASK_CHANGE_STATUS: 'task.change_status',
  TASK_DELETE: 'task.delete',

  // Cross-department transfers (3)
  TRANSFER_REQUEST: 'transfer.request',
  TRANSFER_RESPOND: 'transfer.respond',
  TRANSFER_VIEW: 'transfer.view',

  // Cross-department help requests (3)
  // Workers/staff who realise the issue needs another dept's expertise can
  // request help (the complaint stays put). Receiving HOD responds. Both
  // sides see/track the request.
  HELP_REQUEST: 'help.request',     // create / cancel a help request
  HELP_RESPOND: 'help.respond',     // accept/decline, assign helper, submit/approve helper work
  HELP_VIEW:    'help.view',        // see help-request lists & detail

  // Audit log (1)
  // Tenant-scoped read access to the municipality's own audit trail.
  AUDIT_VIEW: 'audit.view',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * Permissions grouped by module — used for the role permissions matrix UI.
 *
 * `moduleLabelKey` maps to the i18n key `permissions.module.<x>`. The matrix
 * looks up each permission's translated label via `t('permissions.<key>')`.
 *
 * Adding the full enumeration here keeps the matrix complete with every
 * permission that exists on the backend (Tasks, Transfers, Help, etc.).
 */
export const PERMISSION_MODULES: Record<string, { moduleLabelKey: string; items: { key: string }[] }> = {
  complaints: {
    moduleLabelKey: 'permissions.module.complaints',
    items: [
      { key: PERMISSIONS.COMPLAINT_CREATE },
      { key: PERMISSIONS.COMPLAINT_VIEW_OWN },
      { key: PERMISSIONS.COMPLAINT_VIEW_ASSIGNED },
      { key: PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT },
      { key: PERMISSIONS.COMPLAINT_VIEW_ALL },
      { key: PERMISSIONS.COMPLAINT_ASSIGN },
      { key: PERMISSIONS.COMPLAINT_CHANGE_STATUS },
      { key: PERMISSIONS.COMPLAINT_UPLOAD_ATTACHMENT },
      { key: PERMISSIONS.COMPLAINT_VERIFY },
      { key: PERMISSIONS.COMPLAINT_APPROVE },
      { key: PERMISSIONS.COMPLAINT_REJECT },
      { key: PERMISSIONS.COMPLAINT_SET_PRIORITY },
    ],
  },
  categories: {
    moduleLabelKey: 'permissions.module.categories',
    items: [
      { key: PERMISSIONS.CATEGORY_CREATE },
      { key: PERMISSIONS.CATEGORY_UPDATE },
      { key: PERMISSIONS.CATEGORY_DELETE },
    ],
  },
  departments: {
    moduleLabelKey: 'permissions.module.departments',
    items: [
      { key: PERMISSIONS.DEPARTMENT_CREATE },
      { key: PERMISSIONS.DEPARTMENT_UPDATE },
      { key: PERMISSIONS.DEPARTMENT_DELETE },
    ],
  },
  users: {
    moduleLabelKey: 'permissions.module.users',
    items: [
      { key: PERMISSIONS.USER_VIEW_DEPARTMENT },
      { key: PERMISSIONS.USER_VIEW_ALL },
      { key: PERMISSIONS.USER_CREATE },
      { key: PERMISSIONS.USER_UPDATE },
      { key: PERMISSIONS.USER_ASSIGN_ROLE },
    ],
  },
  roles: {
    moduleLabelKey: 'permissions.module.roles',
    items: [
      { key: PERMISSIONS.ROLE_VIEW },
      { key: PERMISSIONS.ROLE_CREATE },
      { key: PERMISSIONS.ROLE_UPDATE },
      { key: PERMISSIONS.ROLE_DELETE },
      { key: PERMISSIONS.ROLE_MANAGE_PERMISSIONS },
    ],
  },
  news: {
    moduleLabelKey: 'permissions.module.news',
    items: [
      { key: PERMISSIONS.NEWS_VIEW_ALL },
      { key: PERMISSIONS.NEWS_CREATE },
      { key: PERMISSIONS.NEWS_UPDATE },
      { key: PERMISSIONS.NEWS_DELETE },
      { key: PERMISSIONS.NEWS_PUBLISH },
    ],
  },
  reports: {
    moduleLabelKey: 'permissions.module.reports',
    items: [
      { key: PERMISSIONS.REPORT_VIEW_DEPARTMENT },
      { key: PERMISSIONS.REPORT_VIEW_ALL },
    ],
  },
  kyc: {
    moduleLabelKey: 'permissions.module.kyc',
    items: [
      { key: PERMISSIONS.KYC_SUBMIT },
      { key: PERMISSIONS.KYC_VIEW_OWN },
      { key: PERMISSIONS.KYC_VIEW_ALL },
      { key: PERMISSIONS.KYC_REVIEW },
    ],
  },
  municipality: {
    moduleLabelKey: 'permissions.module.municipality',
    items: [
      { key: PERMISSIONS.MUNICIPALITY_UPDATE },
    ],
  },
  tasks: {
    moduleLabelKey: 'permissions.module.tasks',
    items: [
      { key: PERMISSIONS.TASK_VIEW_ALL },
      { key: PERMISSIONS.TASK_VIEW_DEPARTMENT },
      { key: PERMISSIONS.TASK_VIEW_ASSIGNED },
      { key: PERMISSIONS.TASK_CREATE },
      { key: PERMISSIONS.TASK_ASSIGN },
      { key: PERMISSIONS.TASK_UPDATE },
      { key: PERMISSIONS.TASK_CHANGE_STATUS },
      { key: PERMISSIONS.TASK_DELETE },
    ],
  },
  transfers: {
    moduleLabelKey: 'permissions.module.transfers',
    items: [
      { key: PERMISSIONS.TRANSFER_REQUEST },
      { key: PERMISSIONS.TRANSFER_RESPOND },
      { key: PERMISSIONS.TRANSFER_VIEW },
    ],
  },
  helpRequests: {
    moduleLabelKey: 'permissions.module.help-requests',
    items: [
      { key: PERMISSIONS.HELP_REQUEST },
      { key: PERMISSIONS.HELP_RESPOND },
      { key: PERMISSIONS.HELP_VIEW },
    ],
  },
  audit: {
    moduleLabelKey: 'permissions.module.audit',
    items: [
      { key: PERMISSIONS.AUDIT_VIEW },
    ],
  },
};

/** Permissions applied client-side for citizen accounts when the API omits them. */
export const CITIZEN_PERMISSIONS: readonly string[] = [
  PERMISSIONS.COMPLAINT_CREATE,
  PERMISSIONS.COMPLAINT_VIEW_OWN,
  PERMISSIONS.COMPLAINT_UPLOAD_ATTACHMENT,
  PERMISSIONS.KYC_SUBMIT,
  PERMISSIONS.KYC_VIEW_OWN,
];
