export const PERMISSIONS = {
  // Complaints (12)
  COMPLAINT_CREATE: 'complaint.create',
  COMPLAINT_VIEW_OWN: 'complaint.view_own',
  COMPLAINT_VIEW_ALL: 'complaint.view_all',
  COMPLAINT_VIEW_ASSIGNED: 'complaint.view_assigned',
  COMPLAINT_VIEW_DEPARTMENT: 'complaint.view_department',
  COMPLAINT_ASSIGN: 'complaint.assign',
  COMPLAINT_CHANGE_STATUS: 'complaint.change_status',
  COMPLAINT_UPLOAD_ATTACHMENT: 'complaint.upload_attachment',
  COMPLAINT_VERIFY: 'complaint.verify',
  COMPLAINT_APPROVE: 'complaint.approve',
  COMPLAINT_REJECT: 'complaint.reject',
  COMPLAINT_SET_PRIORITY: 'complaint.set_priority',

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
  USER_VIEW_DEPARTMENT: 'user.view_department',
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

  // Reports (2)
  REPORT_VIEW_DEPARTMENT: 'report.view_department',
  REPORT_VIEW_ALL: 'report.view_all',

  // KYC (4)
  KYC_SUBMIT: 'kyc.submit',
  KYC_VIEW_OWN: 'kyc.view_own',
  KYC_VIEW_ALL: 'kyc.view_all',
  KYC_REVIEW: 'kyc.review',

  // Municipality (1)
  MUNICIPALITY_UPDATE: 'municipality.update',

  // Audit (tenant-scoped) — view audit trail limited to caller's municipality
  AUDIT_VIEW: 'audit.view',

  // Platform / Super Admin (6)
  PLATFORM_VIEW_ALL: 'platform.view_all',
  PLATFORM_MANAGE_MUNICIPALITIES: 'platform.manage_municipalities',
  PLATFORM_MANAGE_USERS: 'platform.manage_users',
  PLATFORM_VIEW_AUDIT: 'platform.view_audit',
  PLATFORM_IMPERSONATE: 'platform.impersonate',
  PLATFORM_VIEW_STATS: 'platform.view_stats',
  PLATFORM_MANAGE_ANNOUNCEMENTS: 'platform.manage_announcements',

  // Internal Tasks (8) — staff-only work items, separate from citizen complaints
  TASK_VIEW_ALL: 'task.view_all',
  TASK_VIEW_DEPARTMENT: 'task.view_department',
  TASK_VIEW_ASSIGNED: 'task.view_assigned',
  TASK_CREATE: 'task.create',
  TASK_ASSIGN: 'task.assign',          // intra-department only
  TASK_UPDATE: 'task.update',
  TASK_CHANGE_STATUS: 'task.change_status',
  TASK_DELETE: 'task.delete',

  // Cross-department transfer workflow (3)
  // Sender side — open a transfer request to another department.
  // Workers cannot do this directly; they must escalate to their Supervisor/HOD.
  TRANSFER_REQUEST: 'transfer.request',
  // Receiver side — accept (and pick assignee) or reject incoming requests.
  TRANSFER_RESPOND: 'transfer.respond',
  // Read access — see transfer history on a complaint/task page
  TRANSFER_VIEW: 'transfer.view',

  // Cross-department help-request workflow (3)
  // Sender side — when a worker / supervisor / HOD on a complaint discovers it
  // needs another department's expertise but DOES NOT want to give up
  // ownership, they file a help request. Workers CAN do this directly because
  // they are usually first to spot the need on the ground.
  HELP_REQUEST: 'help.request',
  // Receiver side — helper-department HOD accepts/declines, picks an assignee,
  // and submits / cancels the helper work.
  HELP_RESPOND: 'help.respond',
  // Read access — see help-request lists & detail
  HELP_VIEW: 'help.view',
} as const;

export const ALL_PERMISSIONS = Object.values(PERMISSIONS);

/**
 * Permissions reserved for the platform-wide Super Admin only.
 * These must NEVER be granted to municipality-level roles, even "Admin".
 */
export const PLATFORM_ONLY_PERMISSIONS: string[] = [
  PERMISSIONS.PLATFORM_VIEW_ALL,
  PERMISSIONS.PLATFORM_MANAGE_MUNICIPALITIES,
  PERMISSIONS.PLATFORM_MANAGE_USERS,
  PERMISSIONS.PLATFORM_VIEW_AUDIT,
  PERMISSIONS.PLATFORM_IMPERSONATE,
  PERMISSIONS.PLATFORM_VIEW_STATS,
  PERMISSIONS.PLATFORM_MANAGE_ANNOUNCEMENTS,
];

/** Permissions safe to grant to a municipality-level Admin (everything except platform.*) */
export const TENANT_ADMIN_PERMISSIONS = ALL_PERMISSIONS.filter(
  (p) => !PLATFORM_ONLY_PERMISSIONS.includes(p),
);

/**
 * Permission seed data with multilingual labels (EN/AR/FR).
 * Government / formal terminology in Arabic and French.
 */
export const PERMISSION_SEED_DATA = [
  // Complaints
  { key: PERMISSIONS.COMPLAINT_CREATE, name: 'Create Complaints', nameAr: 'تقديم شكاوى', nameFr: 'Déposer des réclamations', module: 'complaints' },
  { key: PERMISSIONS.COMPLAINT_VIEW_OWN, name: 'View Own Complaints', nameAr: 'عرض الشكاوى الشخصية', nameFr: 'Consulter ses propres réclamations', module: 'complaints' },
  { key: PERMISSIONS.COMPLAINT_VIEW_ALL, name: 'View All Complaints', nameAr: 'عرض جميع الشكاوى', nameFr: 'Consulter toutes les réclamations', module: 'complaints' },
  { key: PERMISSIONS.COMPLAINT_VIEW_ASSIGNED, name: 'View Assigned Complaints', nameAr: 'عرض الشكاوى المُسندة', nameFr: 'Consulter les réclamations assignées', module: 'complaints' },
  { key: PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT, name: 'View Department Complaints', nameAr: 'عرض شكاوى القسم', nameFr: 'Consulter les réclamations du département', module: 'complaints' },
  { key: PERMISSIONS.COMPLAINT_ASSIGN, name: 'Assign Complaints', nameAr: 'إسناد الشكاوى', nameFr: 'Assigner des réclamations', module: 'complaints' },
  { key: PERMISSIONS.COMPLAINT_CHANGE_STATUS, name: 'Change Complaint Status', nameAr: 'تغيير حالة الشكوى', nameFr: 'Modifier le statut des réclamations', module: 'complaints' },
  { key: PERMISSIONS.COMPLAINT_UPLOAD_ATTACHMENT, name: 'Upload Attachments', nameAr: 'رفع المرفقات', nameFr: 'Téléverser des pièces jointes', module: 'complaints' },
  { key: PERMISSIONS.COMPLAINT_VERIFY, name: 'Verify Work Completion', nameAr: 'التحقق من إنجاز العمل', nameFr: 'Vérifier l\'achèvement des travaux', module: 'complaints' },
  { key: PERMISSIONS.COMPLAINT_APPROVE, name: 'Approve Closure', nameAr: 'اعتماد الإغلاق', nameFr: 'Approuver la clôture', module: 'complaints' },
  { key: PERMISSIONS.COMPLAINT_REJECT, name: 'Reject Complaints', nameAr: 'رفض الشكاوى', nameFr: 'Refuser des réclamations', module: 'complaints' },
  { key: PERMISSIONS.COMPLAINT_SET_PRIORITY, name: 'Set Priority & SLA', nameAr: 'تحديد الأولوية ومدة الإنجاز', nameFr: 'Définir la priorité et le délai (SLA)', module: 'complaints' },
  // Categories
  { key: PERMISSIONS.CATEGORY_CREATE, name: 'Create Categories', nameAr: 'إنشاء الفئات', nameFr: 'Créer des catégories', module: 'categories' },
  { key: PERMISSIONS.CATEGORY_UPDATE, name: 'Update Categories', nameAr: 'تحديث الفئات', nameFr: 'Mettre à jour les catégories', module: 'categories' },
  { key: PERMISSIONS.CATEGORY_DELETE, name: 'Delete Categories', nameAr: 'حذف الفئات', nameFr: 'Supprimer des catégories', module: 'categories' },
  // Departments
  { key: PERMISSIONS.DEPARTMENT_CREATE, name: 'Create Departments', nameAr: 'إنشاء الأقسام', nameFr: 'Créer des départements', module: 'departments' },
  { key: PERMISSIONS.DEPARTMENT_UPDATE, name: 'Update Departments', nameAr: 'تحديث الأقسام', nameFr: 'Mettre à jour les départements', module: 'departments' },
  { key: PERMISSIONS.DEPARTMENT_DELETE, name: 'Delete Departments', nameAr: 'حذف الأقسام', nameFr: 'Supprimer des départements', module: 'departments' },
  // Users
  { key: PERMISSIONS.USER_VIEW_ALL, name: 'View All Users', nameAr: 'عرض جميع المستخدمين', nameFr: 'Consulter tous les utilisateurs', module: 'users' },
  { key: PERMISSIONS.USER_VIEW_DEPARTMENT, name: 'View Department Users', nameAr: 'عرض موظفي القسم', nameFr: 'Consulter les agents du département', module: 'users' },
  { key: PERMISSIONS.USER_CREATE, name: 'Create Users', nameAr: 'إنشاء المستخدمين', nameFr: 'Créer des utilisateurs', module: 'users' },
  { key: PERMISSIONS.USER_UPDATE, name: 'Update Users', nameAr: 'تحديث المستخدمين', nameFr: 'Mettre à jour les utilisateurs', module: 'users' },
  { key: PERMISSIONS.USER_ASSIGN_ROLE, name: 'Assign Roles to Users', nameAr: 'إسناد الأدوار للمستخدمين', nameFr: 'Attribuer des rôles aux utilisateurs', module: 'users' },
  // Roles
  { key: PERMISSIONS.ROLE_VIEW, name: 'View Roles', nameAr: 'عرض الأدوار', nameFr: 'Consulter les rôles', module: 'roles' },
  { key: PERMISSIONS.ROLE_CREATE, name: 'Create Roles', nameAr: 'إنشاء الأدوار', nameFr: 'Créer des rôles', module: 'roles' },
  { key: PERMISSIONS.ROLE_UPDATE, name: 'Update Roles', nameAr: 'تحديث الأدوار', nameFr: 'Mettre à jour les rôles', module: 'roles' },
  { key: PERMISSIONS.ROLE_DELETE, name: 'Delete Roles', nameAr: 'حذف الأدوار', nameFr: 'Supprimer des rôles', module: 'roles' },
  { key: PERMISSIONS.ROLE_MANAGE_PERMISSIONS, name: 'Manage Role Permissions', nameAr: 'إدارة صلاحيات الأدوار', nameFr: 'Gérer les autorisations des rôles', module: 'roles' },
  // News
  { key: PERMISSIONS.NEWS_VIEW_ALL, name: 'View All News (Drafts)', nameAr: 'عرض جميع الأخبار (مع المسودات)', nameFr: 'Consulter toutes les actualités (brouillons)', module: 'news' },
  { key: PERMISSIONS.NEWS_CREATE, name: 'Create News', nameAr: 'إنشاء الأخبار', nameFr: 'Créer des actualités', module: 'news' },
  { key: PERMISSIONS.NEWS_UPDATE, name: 'Update News', nameAr: 'تحديث الأخبار', nameFr: 'Mettre à jour les actualités', module: 'news' },
  { key: PERMISSIONS.NEWS_DELETE, name: 'Delete News', nameAr: 'حذف الأخبار', nameFr: 'Supprimer des actualités', module: 'news' },
  { key: PERMISSIONS.NEWS_PUBLISH, name: 'Publish News', nameAr: 'نشر الأخبار', nameFr: 'Publier des actualités', module: 'news' },
  // Reports
  { key: PERMISSIONS.REPORT_VIEW_DEPARTMENT, name: 'View Department Reports', nameAr: 'عرض تقارير القسم', nameFr: 'Consulter les rapports du département', module: 'reports' },
  { key: PERMISSIONS.REPORT_VIEW_ALL, name: 'View All Reports', nameAr: 'عرض جميع التقارير', nameFr: 'Consulter tous les rapports', module: 'reports' },
  // KYC
  { key: PERMISSIONS.KYC_SUBMIT, name: 'Submit KYC Verification', nameAr: 'تقديم طلب التحقق من الهوية', nameFr: 'Soumettre une vérification d\'identité', module: 'kyc' },
  { key: PERMISSIONS.KYC_VIEW_OWN, name: 'View Own KYC Status', nameAr: 'عرض حالة التحقق الشخصية', nameFr: 'Consulter son propre statut de vérification', module: 'kyc' },
  { key: PERMISSIONS.KYC_VIEW_ALL, name: 'View All KYC Submissions', nameAr: 'عرض جميع طلبات التحقق', nameFr: 'Consulter toutes les vérifications', module: 'kyc' },
  { key: PERMISSIONS.KYC_REVIEW, name: 'Review KYC Submissions', nameAr: 'مراجعة طلبات التحقق', nameFr: 'Examiner les vérifications d\'identité', module: 'kyc' },
  // Municipality
  { key: PERMISSIONS.MUNICIPALITY_UPDATE, name: 'Update Municipality Settings', nameAr: 'تحديث إعدادات البلدية', nameFr: 'Mettre à jour les paramètres de la municipalité', module: 'municipality' },
  // Audit (tenant-scoped)
  { key: PERMISSIONS.AUDIT_VIEW, name: 'View Municipality Audit Log', nameAr: 'عرض سجل تدقيق البلدية', nameFr: 'Consulter le journal d\'audit de la municipalité', module: 'audit' },
  // Platform
  { key: PERMISSIONS.PLATFORM_VIEW_ALL, name: 'View Platform Data (cross-tenant)', nameAr: 'عرض بيانات المنصة (عبر البلديات)', nameFr: 'Consulter les données de la plateforme (inter-municipalités)', module: 'platform' },
  { key: PERMISSIONS.PLATFORM_MANAGE_MUNICIPALITIES, name: 'Manage All Municipalities', nameAr: 'إدارة جميع البلديات', nameFr: 'Gérer toutes les municipalités', module: 'platform' },
  { key: PERMISSIONS.PLATFORM_MANAGE_USERS, name: 'Manage Users Across Municipalities', nameAr: 'إدارة المستخدمين عبر البلديات', nameFr: 'Gérer les utilisateurs inter-municipalités', module: 'platform' },
  { key: PERMISSIONS.PLATFORM_VIEW_AUDIT, name: 'View System Audit Log', nameAr: 'عرض سجل تدقيق النظام', nameFr: 'Consulter le journal d\'audit système', module: 'platform' },
  { key: PERMISSIONS.PLATFORM_IMPERSONATE, name: 'Impersonate Users', nameAr: 'انتحال هوية المستخدمين', nameFr: 'Emprunter l\'identité d\'utilisateurs', module: 'platform' },
  { key: PERMISSIONS.PLATFORM_VIEW_STATS, name: 'View Platform Statistics', nameAr: 'عرض إحصاءات المنصة', nameFr: 'Consulter les statistiques de la plateforme', module: 'platform' },
  { key: PERMISSIONS.PLATFORM_MANAGE_ANNOUNCEMENTS, name: 'Manage Platform Announcements', nameAr: 'إدارة إعلانات المنصة', nameFr: 'Gérer les annonces de la plateforme', module: 'platform' },
  // Internal Tasks
  { key: PERMISSIONS.TASK_VIEW_ALL, name: 'View All Internal Tasks', nameAr: 'عرض جميع المهام الداخلية', nameFr: 'Consulter toutes les tâches internes', module: 'tasks' },
  { key: PERMISSIONS.TASK_VIEW_DEPARTMENT, name: 'View Department Tasks', nameAr: 'عرض مهام القسم', nameFr: 'Consulter les tâches du département', module: 'tasks' },
  { key: PERMISSIONS.TASK_VIEW_ASSIGNED, name: 'View Assigned Tasks', nameAr: 'عرض المهام المُسندة', nameFr: 'Consulter les tâches assignées', module: 'tasks' },
  { key: PERMISSIONS.TASK_CREATE, name: 'Create Internal Tasks', nameAr: 'إنشاء المهام الداخلية', nameFr: 'Créer des tâches internes', module: 'tasks' },
  { key: PERMISSIONS.TASK_ASSIGN, name: 'Assign Tasks (Intra-Department)', nameAr: 'إسناد المهام داخل القسم', nameFr: 'Assigner des tâches (intra-département)', module: 'tasks' },
  { key: PERMISSIONS.TASK_UPDATE, name: 'Update Tasks', nameAr: 'تحديث المهام', nameFr: 'Mettre à jour les tâches', module: 'tasks' },
  { key: PERMISSIONS.TASK_CHANGE_STATUS, name: 'Change Task Status', nameAr: 'تغيير حالة المهام', nameFr: 'Modifier le statut des tâches', module: 'tasks' },
  { key: PERMISSIONS.TASK_DELETE, name: 'Delete Tasks', nameAr: 'حذف المهام', nameFr: 'Supprimer des tâches', module: 'tasks' },
  // Cross-Dept Transfers
  { key: PERMISSIONS.TRANSFER_REQUEST, name: 'Request Cross-Department Transfer', nameAr: 'طلب تحويل بين الأقسام', nameFr: 'Demander un transfert inter-départements', module: 'transfers' },
  { key: PERMISSIONS.TRANSFER_RESPOND, name: 'Respond to Transfer Requests', nameAr: 'الرد على طلبات التحويل', nameFr: 'Répondre aux demandes de transfert', module: 'transfers' },
  { key: PERMISSIONS.TRANSFER_VIEW, name: 'View Transfer History', nameAr: 'عرض سجل التحويلات', nameFr: 'Consulter l\'historique des transferts', module: 'transfers' },
  // Cross-Dept Help Requests
  { key: PERMISSIONS.HELP_REQUEST, name: 'Request Cross-Department Help', nameAr: 'طلب مساعدة من قسم آخر', nameFr: 'Demander l\'aide d\'un autre département', module: 'help-requests' },
  { key: PERMISSIONS.HELP_RESPOND, name: 'Respond to Help Requests', nameAr: 'الرد على طلبات المساعدة', nameFr: 'Répondre aux demandes d\'aide', module: 'help-requests' },
  { key: PERMISSIONS.HELP_VIEW,    name: 'View Help Requests',         nameAr: 'عرض طلبات المساعدة', nameFr: 'Consulter les demandes d\'aide', module: 'help-requests' },
];

// Government-style role configurations.
// `name`/`nameAr`/`nameFr` and `description`/`descriptionAr`/`descriptionFr`
// are upserted into the Role table when a municipality is created so the
// roles UI can display formal localized terminology in EN/AR/FR.
export const DEFAULT_ROLES = {
  CITIZEN: {
    name: 'Citizen',
    nameAr: 'مواطن',
    nameFr: 'Citoyen',
    description: 'Regular citizen who can submit and track complaints',
    descriptionAr: 'مواطن يمكنه تقديم الشكاوى ومتابعة حالتها.',
    descriptionFr: 'Citoyen pouvant déposer et suivre ses réclamations.',
    permissions: [
      PERMISSIONS.COMPLAINT_CREATE,
      PERMISSIONS.COMPLAINT_VIEW_OWN,
      PERMISSIONS.COMPLAINT_UPLOAD_ATTACHMENT,
      PERMISSIONS.KYC_SUBMIT,
      PERMISSIONS.KYC_VIEW_OWN,
    ],
  },
  FIELD_WORKER: {
    name: 'Field Worker',
    nameAr: 'عامل ميداني',
    nameFr: 'Agent de terrain',
    description: 'Field worker who handles assigned complaints on-site',
    descriptionAr: 'عامل ميداني يتولى تنفيذ الشكاوى المُسندة إليه على أرض الواقع.',
    descriptionFr: 'Agent de terrain chargé du traitement sur site des réclamations qui lui sont assignées.',
    permissions: [
      PERMISSIONS.COMPLAINT_VIEW_ASSIGNED,
      PERMISSIONS.COMPLAINT_CHANGE_STATUS,
      PERMISSIONS.COMPLAINT_UPLOAD_ATTACHMENT,
      // Internal tasks: workers see/work-on what's assigned to them but
      // cannot create or assign — and crucially cannot initiate cross-dept transfers.
      PERMISSIONS.TASK_VIEW_ASSIGNED,
      PERMISSIONS.TASK_CHANGE_STATUS,
      PERMISSIONS.TRANSFER_VIEW,
      // Workers can SEE help requests they are involved in (assigned helper)
      // but cannot OPEN one directly — the service rejects requests from
      // users without dept-level visibility. They escalate through their
      // Supervisor/HOD instead, who opens the formal request with full
      // source-side accountability. This prevents cross-department friction
      // from being triggered by a single field worker.
      PERMISSIONS.HELP_VIEW,
    ],
  },
  SUPERVISOR: {
    name: 'Supervisor',
    nameAr: 'مشرف',
    nameFr: 'Superviseur',
    description: 'Team supervisor who assigns work and verifies completion',
    descriptionAr: 'مشرف الفريق المسؤول عن إسناد الأعمال والتحقق من إنجازها.',
    descriptionFr: 'Superviseur d\'équipe chargé d\'assigner les travaux et de vérifier leur achèvement.',
    permissions: [
      PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT,
      PERMISSIONS.COMPLAINT_VIEW_ASSIGNED,
      PERMISSIONS.COMPLAINT_ASSIGN,
      PERMISSIONS.COMPLAINT_CHANGE_STATUS,
      PERMISSIONS.COMPLAINT_UPLOAD_ATTACHMENT,
      PERMISSIONS.COMPLAINT_VERIFY,
      PERMISSIONS.COMPLAINT_REJECT,
      PERMISSIONS.USER_VIEW_DEPARTMENT,
      PERMISSIONS.REPORT_VIEW_DEPARTMENT,
      // Internal tasks
      PERMISSIONS.TASK_VIEW_DEPARTMENT,
      PERMISSIONS.TASK_VIEW_ASSIGNED,
      PERMISSIONS.TASK_CREATE,
      PERMISSIONS.TASK_ASSIGN,
      PERMISSIONS.TASK_UPDATE,
      PERMISSIONS.TASK_CHANGE_STATUS,
      // Supervisor CAN initiate cross-dept transfers (workers cannot)
      PERMISSIONS.TRANSFER_REQUEST,
      PERMISSIONS.TRANSFER_VIEW,
      // Help requests — supervisor can both raise them and (when their HOD is
      // unavailable) respond on the receiving side.
      PERMISSIONS.HELP_REQUEST,
      PERMISSIONS.HELP_VIEW,
    ],
  },
  HEAD_OF_DEPARTMENT: {
    name: 'Head of Department',
    nameAr: 'رئيس القسم',
    nameFr: 'Chef de département',
    description: 'Department head with approval authority and full department visibility',
    descriptionAr: 'رئيس القسم بصلاحيات الموافقة والإشراف الكامل على شؤون القسم.',
    descriptionFr: 'Chef de département disposant de l\'autorité d\'approbation et d\'une visibilité complète sur le département.',
    permissions: [
      PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT,
      PERMISSIONS.COMPLAINT_VIEW_ASSIGNED,
      PERMISSIONS.COMPLAINT_ASSIGN,
      PERMISSIONS.COMPLAINT_CHANGE_STATUS,
      PERMISSIONS.COMPLAINT_UPLOAD_ATTACHMENT,
      PERMISSIONS.COMPLAINT_VERIFY,
      PERMISSIONS.COMPLAINT_APPROVE,
      PERMISSIONS.COMPLAINT_REJECT,
      PERMISSIONS.COMPLAINT_SET_PRIORITY,
      PERMISSIONS.CATEGORY_CREATE,
      PERMISSIONS.CATEGORY_UPDATE,
      PERMISSIONS.USER_VIEW_DEPARTMENT,
      PERMISSIONS.USER_CREATE,
      PERMISSIONS.USER_UPDATE,
      PERMISSIONS.NEWS_CREATE,
      PERMISSIONS.NEWS_UPDATE,
      PERMISSIONS.REPORT_VIEW_DEPARTMENT,
      // Internal tasks (full power within their dept)
      PERMISSIONS.TASK_VIEW_DEPARTMENT,
      PERMISSIONS.TASK_VIEW_ASSIGNED,
      PERMISSIONS.TASK_CREATE,
      PERMISSIONS.TASK_ASSIGN,
      PERMISSIONS.TASK_UPDATE,
      PERMISSIONS.TASK_CHANGE_STATUS,
      PERMISSIONS.TASK_DELETE,
      // Cross-dept transfers — both sides
      PERMISSIONS.TRANSFER_REQUEST,
      PERMISSIONS.TRANSFER_RESPOND,
      PERMISSIONS.TRANSFER_VIEW,
      // Help requests — HOD owns the receiving side (accept/decline/assign)
      // and can also raise them on behalf of their team.
      PERMISSIONS.HELP_REQUEST,
      PERMISSIONS.HELP_RESPOND,
      PERMISSIONS.HELP_VIEW,
      // Audit — HOD can see audit events scoped to their municipality so they
      // can investigate "who reassigned this complaint?", "who edited this user?".
      PERMISSIONS.AUDIT_VIEW,
    ],
  },
  VERIFIER: {
    name: 'Verifier',
    nameAr: 'مدقق هوية',
    nameFr: 'Vérificateur',
    description: 'Reviews and approves citizen identity verification submissions',
    descriptionAr: 'يراجع طلبات التحقق من هوية المواطنين ويعتمدها.',
    descriptionFr: 'Examine et approuve les demandes de vérification d\'identité des citoyens.',
    permissions: [
      PERMISSIONS.KYC_VIEW_ALL,
      PERMISSIONS.KYC_REVIEW,
      PERMISSIONS.USER_VIEW_ALL,
    ],
  },
  ASSIGNER: {
    name: 'Assigner',
    nameAr: 'مُوزِّع الشكاوى',
    nameFr: 'Affectateur',
    description: 'Municipality-wide triager who routes incoming complaints to the appropriate department.',
    descriptionAr: 'مسؤول فرز الشكاوى الواردة وتوجيهها إلى الأقسام المختصة على مستوى البلدية.',
    descriptionFr: 'Trieur à l\'échelle de la municipalité qui oriente les réclamations entrantes vers le département approprié.',
    permissions: [
      PERMISSIONS.COMPLAINT_VIEW_ALL,
      PERMISSIONS.COMPLAINT_ASSIGN,
      PERMISSIONS.COMPLAINT_CHANGE_STATUS,
    ],
  },
  ADMIN: {
    name: 'Admin',
    nameAr: 'مدير',
    nameFr: 'Administrateur',
    description: 'Municipality administrator with all permissions (within their municipality)',
    descriptionAr: 'مدير البلدية بكامل الصلاحيات داخل بلديته.',
    descriptionFr: 'Administrateur de la municipalité disposant de toutes les autorisations dans sa municipalité.',
    permissions: TENANT_ADMIN_PERMISSIONS,
  },
};
