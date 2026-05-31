import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// ============================================================
// Permission seed data — multilingual (EN/AR/FR)
// ============================================================
// Single source of truth lives in src/core/rbac/permissions.constants.ts.
// We import from compiled output to avoid TS path issues during ts-node seed runs.
// (Full enumeration is duplicated below to keep the seed self-contained.)
const PERMISSION_SEED_DATA = [
  // Complaints
  { key: 'complaint.create', name: 'Create Complaints', nameAr: 'تقديم شكاوى', nameFr: 'Déposer des réclamations', module: 'complaints' },
  { key: 'complaint.view_own', name: 'View Own Complaints', nameAr: 'عرض الشكاوى الشخصية', nameFr: 'Consulter ses propres réclamations', module: 'complaints' },
  { key: 'complaint.view_all', name: 'View All Complaints', nameAr: 'عرض جميع الشكاوى', nameFr: 'Consulter toutes les réclamations', module: 'complaints' },
  { key: 'complaint.view_assigned', name: 'View Assigned Complaints', nameAr: 'عرض الشكاوى المُسندة', nameFr: 'Consulter les réclamations assignées', module: 'complaints' },
  { key: 'complaint.view_department', name: 'View Department Complaints', nameAr: 'عرض شكاوى القسم', nameFr: 'Consulter les réclamations du département', module: 'complaints' },
  { key: 'complaint.assign', name: 'Assign Complaints', nameAr: 'إسناد الشكاوى', nameFr: 'Assigner des réclamations', module: 'complaints' },
  { key: 'complaint.change_status', name: 'Change Complaint Status', nameAr: 'تغيير حالة الشكوى', nameFr: 'Modifier le statut des réclamations', module: 'complaints' },
  { key: 'complaint.upload_attachment', name: 'Upload Attachments', nameAr: 'رفع المرفقات', nameFr: 'Téléverser des pièces jointes', module: 'complaints' },
  { key: 'complaint.verify', name: 'Verify Work Completion', nameAr: 'التحقق من إنجاز العمل', nameFr: 'Vérifier l\'achèvement des travaux', module: 'complaints' },
  { key: 'complaint.approve', name: 'Approve Closure', nameAr: 'اعتماد الإغلاق', nameFr: 'Approuver la clôture', module: 'complaints' },
  { key: 'complaint.reject', name: 'Reject Complaints', nameAr: 'رفض الشكاوى', nameFr: 'Refuser des réclamations', module: 'complaints' },
  { key: 'complaint.set_priority', name: 'Set Priority & SLA', nameAr: 'تحديد الأولوية ومدة الإنجاز', nameFr: 'Définir la priorité et le SLA', module: 'complaints' },
  // Categories
  { key: 'category.create', name: 'Create Categories', nameAr: 'إنشاء الفئات', nameFr: 'Créer des catégories', module: 'categories' },
  { key: 'category.update', name: 'Update Categories', nameAr: 'تحديث الفئات', nameFr: 'Mettre à jour les catégories', module: 'categories' },
  { key: 'category.delete', name: 'Delete Categories', nameAr: 'حذف الفئات', nameFr: 'Supprimer des catégories', module: 'categories' },
  // Departments
  { key: 'department.create', name: 'Create Departments', nameAr: 'إنشاء الأقسام', nameFr: 'Créer des départements', module: 'departments' },
  { key: 'department.update', name: 'Update Departments', nameAr: 'تحديث الأقسام', nameFr: 'Mettre à jour les départements', module: 'departments' },
  { key: 'department.delete', name: 'Delete Departments', nameAr: 'حذف الأقسام', nameFr: 'Supprimer des départements', module: 'departments' },
  // Users
  { key: 'user.view_all', name: 'View All Users', nameAr: 'عرض جميع المستخدمين', nameFr: 'Consulter tous les utilisateurs', module: 'users' },
  { key: 'user.view_department', name: 'View Department Users', nameAr: 'عرض موظفي القسم', nameFr: 'Consulter les agents du département', module: 'users' },
  { key: 'user.create', name: 'Create Users', nameAr: 'إنشاء المستخدمين', nameFr: 'Créer des utilisateurs', module: 'users' },
  { key: 'user.update', name: 'Update Users', nameAr: 'تحديث المستخدمين', nameFr: 'Mettre à jour les utilisateurs', module: 'users' },
  { key: 'user.assign_role', name: 'Assign Roles to Users', nameAr: 'إسناد الأدوار للمستخدمين', nameFr: 'Attribuer des rôles aux utilisateurs', module: 'users' },
  // Roles
  { key: 'role.view', name: 'View Roles', nameAr: 'عرض الأدوار', nameFr: 'Consulter les rôles', module: 'roles' },
  { key: 'role.create', name: 'Create Roles', nameAr: 'إنشاء الأدوار', nameFr: 'Créer des rôles', module: 'roles' },
  { key: 'role.update', name: 'Update Roles', nameAr: 'تحديث الأدوار', nameFr: 'Mettre à jour les rôles', module: 'roles' },
  { key: 'role.delete', name: 'Delete Roles', nameAr: 'حذف الأدوار', nameFr: 'Supprimer des rôles', module: 'roles' },
  { key: 'role.manage_permissions', name: 'Manage Role Permissions', nameAr: 'إدارة صلاحيات الأدوار', nameFr: 'Gérer les autorisations des rôles', module: 'roles' },
  // News
  { key: 'news.view_all', name: 'View All News (Drafts)', nameAr: 'عرض جميع الأخبار (مع المسودات)', nameFr: 'Consulter toutes les actualités (brouillons)', module: 'news' },
  { key: 'news.create', name: 'Create News', nameAr: 'إنشاء الأخبار', nameFr: 'Créer des actualités', module: 'news' },
  { key: 'news.update', name: 'Update News', nameAr: 'تحديث الأخبار', nameFr: 'Mettre à jour les actualités', module: 'news' },
  { key: 'news.delete', name: 'Delete News', nameAr: 'حذف الأخبار', nameFr: 'Supprimer des actualités', module: 'news' },
  { key: 'news.publish', name: 'Publish News', nameAr: 'نشر الأخبار', nameFr: 'Publier des actualités', module: 'news' },
  // Reports
  { key: 'report.view_department', name: 'View Department Reports', nameAr: 'عرض تقارير القسم', nameFr: 'Consulter les rapports du département', module: 'reports' },
  { key: 'report.view_all', name: 'View All Reports', nameAr: 'عرض جميع التقارير', nameFr: 'Consulter tous les rapports', module: 'reports' },
  // KYC
  { key: 'kyc.submit', name: 'Submit KYC Verification', nameAr: 'تقديم طلب التحقق من الهوية', nameFr: 'Soumettre une vérification d\'identité', module: 'kyc' },
  { key: 'kyc.view_own', name: 'View Own KYC Status', nameAr: 'عرض حالة التحقق الشخصية', nameFr: 'Consulter son propre statut de vérification', module: 'kyc' },
  { key: 'kyc.view_all', name: 'View All KYC Submissions', nameAr: 'عرض جميع طلبات التحقق', nameFr: 'Consulter toutes les vérifications', module: 'kyc' },
  { key: 'kyc.review', name: 'Review KYC Submissions', nameAr: 'مراجعة طلبات التحقق', nameFr: 'Examiner les vérifications d\'identité', module: 'kyc' },
  // Municipality
  { key: 'municipality.update', name: 'Update Municipality Settings', nameAr: 'تحديث إعدادات البلدية', nameFr: 'Mettre à jour les paramètres de la municipalité', module: 'municipality' },
  // Audit
  { key: 'audit.view', name: 'View Municipality Audit Log', nameAr: 'عرض سجل تدقيق البلدية', nameFr: 'Consulter le journal d\'audit de la municipalité', module: 'audit' },
  // Platform
  { key: 'platform.view_all', name: 'View Platform Data (cross-tenant)', nameAr: 'عرض بيانات المنصة', nameFr: 'Consulter les données de la plateforme', module: 'platform' },
  { key: 'platform.manage_municipalities', name: 'Manage All Municipalities', nameAr: 'إدارة جميع البلديات', nameFr: 'Gérer toutes les municipalités', module: 'platform' },
  { key: 'platform.manage_users', name: 'Manage Users Across Municipalities', nameAr: 'إدارة المستخدمين عبر البلديات', nameFr: 'Gérer les utilisateurs inter-municipalités', module: 'platform' },
  { key: 'platform.view_audit', name: 'View System Audit Log', nameAr: 'عرض سجل تدقيق النظام', nameFr: 'Consulter le journal d\'audit système', module: 'platform' },
  { key: 'platform.impersonate', name: 'Impersonate Users', nameAr: 'انتحال هوية المستخدمين', nameFr: 'Emprunter l\'identité d\'utilisateurs', module: 'platform' },
  { key: 'platform.view_stats', name: 'View Platform Statistics', nameAr: 'عرض إحصاءات المنصة', nameFr: 'Consulter les statistiques de la plateforme', module: 'platform' },
  { key: 'platform.manage_announcements', name: 'Manage Platform Announcements', nameAr: 'إدارة إعلانات المنصة', nameFr: 'Gérer les annonces de la plateforme', module: 'platform' },
  { key: 'platform.send_notifications', name: 'Send Platform Broadcast Notifications', nameAr: 'إرسال إشعارات البث على المنصة', nameFr: 'Envoyer des notifications de diffusion plateforme', module: 'platform' },
  // Tasks
  { key: 'task.view_all', name: 'View All Internal Tasks', nameAr: 'عرض جميع المهام الداخلية', nameFr: 'Consulter toutes les tâches internes', module: 'tasks' },
  { key: 'task.view_department', name: 'View Department Tasks', nameAr: 'عرض مهام القسم', nameFr: 'Consulter les tâches du département', module: 'tasks' },
  { key: 'task.view_assigned', name: 'View Assigned Tasks', nameAr: 'عرض المهام المُسندة', nameFr: 'Consulter les tâches assignées', module: 'tasks' },
  { key: 'task.create', name: 'Create Internal Tasks', nameAr: 'إنشاء المهام الداخلية', nameFr: 'Créer des tâches internes', module: 'tasks' },
  { key: 'task.assign', name: 'Assign Tasks (Intra-Department)', nameAr: 'إسناد المهام داخل القسم', nameFr: 'Assigner des tâches (intra-département)', module: 'tasks' },
  { key: 'task.update', name: 'Update Tasks', nameAr: 'تحديث المهام', nameFr: 'Mettre à jour les tâches', module: 'tasks' },
  { key: 'task.change_status', name: 'Change Task Status', nameAr: 'تغيير حالة المهام', nameFr: 'Modifier le statut des tâches', module: 'tasks' },
  { key: 'task.delete', name: 'Delete Tasks', nameAr: 'حذف المهام', nameFr: 'Supprimer des tâches', module: 'tasks' },
  // Transfers
  { key: 'transfer.request', name: 'Request Cross-Department Transfer', nameAr: 'طلب تحويل بين الأقسام', nameFr: 'Demander un transfert inter-départements', module: 'transfers' },
  { key: 'transfer.respond', name: 'Respond to Transfer Requests', nameAr: 'الرد على طلبات التحويل', nameFr: 'Répondre aux demandes de transfert', module: 'transfers' },
  { key: 'transfer.view', name: 'View Transfer History', nameAr: 'عرض سجل التحويلات', nameFr: 'Consulter l\'historique des transferts', module: 'transfers' },
  // Help Requests
  { key: 'help.request', name: 'Request Cross-Department Help', nameAr: 'طلب مساعدة من قسم آخر', nameFr: 'Demander l\'aide d\'un autre département', module: 'help-requests' },
  { key: 'help.respond', name: 'Respond to Help Requests', nameAr: 'الرد على طلبات المساعدة', nameFr: 'Répondre aux demandes d\'aide', module: 'help-requests' },
  { key: 'help.view', name: 'View Help Requests', nameAr: 'عرض طلبات المساعدة', nameFr: 'Consulter les demandes d\'aide', module: 'help-requests' },
];

// ============================================================
// Government role hierarchy
// ============================================================
const DEFAULT_ROLES = {
  // Citizens - can submit and track their complaints
  CITIZEN: {
    name: 'Citizen',
    nameAr: 'مواطن',
    nameFr: 'Citoyen',
    description: 'Regular citizen who can submit and track complaints',
    descriptionAr: 'مواطن يمكنه تقديم الشكاوى ومتابعة حالتها.',
    descriptionFr: 'Citoyen pouvant déposer et suivre ses réclamations.',
    priority: 0,
    permissions: [
      'complaint.create',
      'complaint.view_own',
      'complaint.upload_attachment',
      'kyc.submit',
      'kyc.view_own',
    ],
  },
  
  // Field Workers - mobile app users who do the actual work
  FIELD_WORKER: {
    name: 'Field Worker',
    nameAr: 'عامل ميداني',
    nameFr: 'Agent de terrain',
    description: 'Field worker who handles assigned complaints on-site',
    descriptionAr: 'عامل ميداني يتولى تنفيذ الشكاوى المُسندة إليه على أرض الواقع.',
    descriptionFr: 'Agent de terrain chargé du traitement sur site des réclamations qui lui sont assignées.',
    priority: 30,
    permissions: [
      'complaint.view_assigned',
      'complaint.change_status',       // Can mark as IN_PROGRESS, PENDING_APPROVAL
      'complaint.upload_attachment',   // Upload proof photos
      'task.view_assigned',
      'task.change_status',
      'transfer.view',
      // Workers can raise (and view) help requests when they spot the
      // complaint needs another department's help on the ground.
      'help.request',
      'help.view',
    ],
  },
  
  // Supervisors - team leads who assign work and verify completion
  SUPERVISOR: {
    name: 'Supervisor',
    nameAr: 'مشرف',
    nameFr: 'Superviseur',
    description: 'Team supervisor who assigns work and verifies completion',
    descriptionAr: 'مشرف الفريق المسؤول عن إسناد الأعمال والتحقق من إنجازها.',
    descriptionFr: 'Superviseur d\'équipe chargé d\'assigner les travaux et de vérifier leur achèvement.',
    priority: 60,
    permissions: [
      'complaint.view_department',     // See all department complaints
      'complaint.view_assigned',
      'complaint.assign',              // Assign to field workers
      'complaint.change_status',
      'complaint.upload_attachment',
      'complaint.verify',              // Verify work completion
      'complaint.reject',              // Can reject with reason
      'user.view_department',          // See team members
      'report.view_department',
      'task.view_department',
      'task.view_assigned',
      'task.create',
      'task.assign',
      'task.update',
      'task.change_status',
      'transfer.request',
      'transfer.view',
      'help.request',
      'help.view',
    ],
  },
  
  // Head of Department - department manager with full control
  HEAD_OF_DEPARTMENT: {
    name: 'Head of Department',
    nameAr: 'رئيس القسم',
    nameFr: 'Chef de département',
    description: 'Department head with approval authority and full department visibility',
    descriptionAr: 'رئيس القسم بصلاحيات الموافقة والإشراف الكامل على شؤون القسم.',
    descriptionFr: 'Chef de département disposant de l\'autorité d\'approbation et d\'une visibilité complète sur le département.',
    priority: 80,
    permissions: [
      'complaint.view_department',
      'complaint.view_assigned',
      'complaint.assign',
      'complaint.change_status',
      'complaint.upload_attachment',
      'complaint.verify',
      'complaint.approve',             // Final approval for closure
      'complaint.reject',
      'complaint.set_priority',        // Set priority and SLA
      'category.create',
      'category.update',
      'user.view_department',
      'user.create',                   // Create staff in department
      'user.update',
      'news.create',
      'news.update',
      'report.view_department',
      'task.view_department',
      'task.view_assigned',
      'task.create',
      'task.assign',
      'task.update',
      'task.change_status',
      'task.delete',
      'transfer.request',
      'transfer.respond',
      'transfer.view',
      // HOD owns the receiving side of help requests (accept/decline,
      // assign helper worker, submit/approve helper work).
      'help.request',
      'help.respond',
      'help.view',
      // Audit — HOD can read the audit trail scoped to their municipality.
      'audit.view',
    ],
  },
  
  // Verifier - identity verification reviewer
  VERIFIER: {
    name: 'Verifier',
    nameAr: 'مدقق هوية',
    nameFr: 'Vérificateur',
    description: 'Reviews and approves citizen identity verification submissions',
    descriptionAr: 'يراجع طلبات التحقق من هوية المواطنين ويعتمدها.',
    descriptionFr: 'Examine et approuve les demandes de vérification d\'identité des citoyens.',
    priority: 50,
    permissions: [
      'kyc.view_all',
      'kyc.review',
      'user.view_all',
    ],
  },

  // Assigner - municipality-wide complaint triager. Receives every incoming
  // complaint and routes it to the right department; doesn't belong to any
  // single department, so on the org chart they hang directly off the muni.
  ASSIGNER: {
    name: 'Assigner',
    nameAr: 'مُوزِّع الشكاوى',
    nameFr: 'Affectateur',
    description:
      'Municipality-wide triager: routes incoming complaints to the appropriate department.',
    descriptionAr: 'مسؤول فرز الشكاوى الواردة وتوجيهها إلى الأقسام المختصة على مستوى البلدية.',
    descriptionFr: 'Trieur à l\'échelle de la municipalité qui oriente les réclamations vers le département approprié.',
    priority: 50,
    permissions: [
      'complaint.view_all',
      'complaint.assign',
      'complaint.set_priority',
      'complaint.classify',
      'user.view_all',
      'category.create',
      'category.update',
      'category.delete',
    ],
  },

  // Admin - full municipality access (NOT platform-level)
  ADMIN: {
    name: 'Admin',
    nameAr: 'مدير',
    nameFr: 'Administrateur',
    description: 'Municipality administrator with all permissions (within their municipality)',
    descriptionAr: 'مدير البلدية بكامل الصلاحيات داخل بلديته.',
    descriptionFr: 'Administrateur de la municipalité disposant de toutes les autorisations dans sa municipalité.',
    priority: 100,
    permissions: PERMISSION_SEED_DATA
      .map(p => p.key)
      .filter(key => !key.startsWith('platform.')),
  },
};

// ============================================================
// Sample users for testing
// ============================================================
const SAMPLE_USERS = [
  // Admin
  { email: 'admin@beirut.gov.lb', firstName: 'System', lastName: 'Admin', role: 'Admin', department: null, password: 'admin123' },
  
  // Roads Department
  { email: 'hod.roads@beirut.gov.lb', firstName: 'Ahmad', lastName: 'Khalil', role: 'Head of Department', department: 'Roads & Infrastructure', password: 'hod123' },
  { email: 'super.roads@beirut.gov.lb', firstName: 'Mariam', lastName: 'Hassan', role: 'Supervisor', department: 'Roads & Infrastructure', password: 'super123' },
  { email: 'worker1.roads@beirut.gov.lb', firstName: 'Ali', lastName: 'Salem', role: 'Field Worker', department: 'Roads & Infrastructure', password: 'worker123' },
  { email: 'worker2.roads@beirut.gov.lb', firstName: 'Hassan', lastName: 'Farah', role: 'Field Worker', department: 'Roads & Infrastructure', password: 'worker123' },

  // Public Works
  { email: 'hod.publicworks@beirut.gov.lb', firstName: 'Rami', lastName: 'Ibrahim', role: 'Head of Department', department: 'Public Works', password: 'hod123' },
  { email: 'super.publicworks@beirut.gov.lb', firstName: 'Yara', lastName: 'Saad', role: 'Supervisor', department: 'Public Works', password: 'super123' },
  { email: 'worker1.publicworks@beirut.gov.lb', firstName: 'Tarek', lastName: 'Najjar', role: 'Field Worker', department: 'Public Works', password: 'worker123' },

  // Sanitation Department
  { email: 'hod.sanitation@beirut.gov.lb', firstName: 'Fatima', lastName: 'Nasr', role: 'Head of Department', department: 'Sanitation', password: 'hod123' },
  { email: 'super.sanitation@beirut.gov.lb', firstName: 'Karim', lastName: 'Ayoub', role: 'Supervisor', department: 'Sanitation', password: 'super123' },
  { email: 'worker1.sanitation@beirut.gov.lb', firstName: 'Omar', lastName: 'Darwish', role: 'Field Worker', department: 'Sanitation', password: 'worker123' },
  
  // Water Authority
  { email: 'hod.water@beirut.gov.lb', firstName: 'Layla', lastName: 'Mansour', role: 'Head of Department', department: 'Water Authority', password: 'hod123' },
  { email: 'super.water@beirut.gov.lb', firstName: 'Samir', lastName: 'Haddad', role: 'Supervisor', department: 'Water Authority', password: 'super123' },
  { email: 'worker1.water@beirut.gov.lb', firstName: 'Nour', lastName: 'Khoury', role: 'Field Worker', department: 'Water Authority', password: 'worker123' },

  // Public Safety
  { email: 'hod.safety@beirut.gov.lb', firstName: 'Khaled', lastName: 'Awad', role: 'Head of Department', department: 'Public Safety', password: 'hod123' },
  { email: 'super.safety@beirut.gov.lb', firstName: 'Lina', lastName: 'Bassil', role: 'Supervisor', department: 'Public Safety', password: 'super123' },
  { email: 'worker1.safety@beirut.gov.lb', firstName: 'Ziad', lastName: 'Shamoun', role: 'Field Worker', department: 'Public Safety', password: 'worker123' },

  // Parks & Recreation
  { email: 'hod.parks@beirut.gov.lb', firstName: 'Hadi', lastName: 'Murad', role: 'Head of Department', department: 'Parks & Recreation', password: 'hod123' },
  { email: 'super.parks@beirut.gov.lb', firstName: 'Dana', lastName: 'Aoun', role: 'Supervisor', department: 'Parks & Recreation', password: 'super123' },
  { email: 'worker1.parks@beirut.gov.lb', firstName: 'Bassem', lastName: 'Tabet', role: 'Field Worker', department: 'Parks & Recreation', password: 'worker123' },

  // A few unassigned staff so HOD/department-move flows are testable
  // (no department, but provisioned as staff so they pass the citizen check)
  { email: 'staff.bench1@beirut.gov.lb', firstName: 'Reem', lastName: 'Halabi', role: 'Field Worker', department: null, password: 'staff123' },
  { email: 'staff.bench2@beirut.gov.lb', firstName: 'Jad', lastName: 'Karam', role: 'Supervisor', department: null, password: 'staff123' },

  // Municipality-wide staff that don't belong to any department. They are
  // shown directly under the municipality on the org chart.
  { email: 'verifier@beirut.gov.lb', firstName: 'Maya', lastName: 'Daher', role: 'Verifier', department: null, password: 'verifier123' },
  { email: 'assigner@beirut.gov.lb', firstName: 'Walid', lastName: 'Hammoud', role: 'Assigner', department: null, password: 'assigner123' },

  // Sample citizen
  { email: 'citizen@test.com', firstName: 'Test', lastName: 'Citizen', role: 'Citizen', department: null, password: 'citizen123' },
];

// ============================================================
// Seed functions
// ============================================================

async function seedPermissions() {
  console.log('Seeding permissions...');
  
  for (const permission of PERMISSION_SEED_DATA) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      update: {
        name: permission.name,
        nameAr: permission.nameAr,
        nameFr: permission.nameFr,
        module: permission.module,
      },
      create: permission,
    });
  }
  
  console.log(`  ✓ Seeded ${PERMISSION_SEED_DATA.length} permissions (EN/AR/FR)`);
}

async function createRolesForMunicipality(municipalityId: string) {
  console.log('Creating roles...');
  const { provisionDefaultMunicipalityRoles } = await import(
    '../src/core/rbac/municipality-roles.provision'
  );
  await provisionDefaultMunicipalityRoles(prisma, municipalityId);
  console.log('  ✓ Default municipal roles provisioned (priority, isSystem, permissions)');
}

async function seedStarterTemplate(municipalityId: string) {
  const {
    applyMunicipalityStarterTemplate,
    MunicipalityStarterTemplate,
    STANDARD_STARTER_CATEGORIES,
    STANDARD_STARTER_DEPARTMENTS,
  } = await import('../src/core/provisioning/municipality-starter-templates');

  console.log('Applying FULL_GOVERNMENT starter template...');
  const result = await applyMunicipalityStarterTemplate(
    prisma,
    municipalityId,
    MunicipalityStarterTemplate.FULL_GOVERNMENT,
  );
  console.log(
    `  ✓ Starter template: ${STANDARD_STARTER_DEPARTMENTS.length} departments, ${STANDARD_STARTER_CATEGORIES.length} categories (EN/AR/FR)`,
  );
  console.log(
    `    created: ${result.departmentsCreated} depts, ${result.categoriesCreated} cats; updated: ${result.departmentsUpdated} depts, ${result.categoriesUpdated} cats`,
  );
}

async function seedUsers(municipalityId: string) {
  console.log('Creating sample users...');
  
  // Get department and role maps
  const departments = await prisma.department.findMany({ where: { municipalityId } });
  const deptMap = new Map(departments.map(d => [d.name, d.id]));
  
  const roles = await prisma.role.findMany({ where: { municipalityId } });
  const roleMap = new Map(roles.map(r => [r.name, r.id]));
  
  // Keep track of supervisors for hierarchy
  const usersByDept: Map<string, { supervisorId?: string }> = new Map();

  for (const userData of SAMPLE_USERS) {
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: userData.email },
    });

    if (existingUser) {
      console.log(`  - User "${userData.email}" already exists`);
      continue;
    }

    const departmentId = userData.department ? deptMap.get(userData.department) : null;
    const roleId = roleMap.get(userData.role);
    
    // Determine supervisor (HODs report to admin, Supervisors report to HOD, Workers report to Supervisor)
    let supervisorId: string | null = null;
    if (userData.department && userData.role === 'Supervisor') {
      // Supervisor reports to HOD of same department
      const hod = await prisma.user.findFirst({
        where: {
          municipalityId,
          departmentId,
          userRoles: { some: { role: { name: 'Head of Department' } } },
        },
      });
      supervisorId = hod?.id || null;
    } else if (userData.department && userData.role === 'Field Worker') {
      // Worker reports to Supervisor of same department
      const supervisor = await prisma.user.findFirst({
        where: {
          municipalityId,
          departmentId,
          userRoles: { some: { role: { name: 'Supervisor' } } },
        },
      });
      supervisorId = supervisor?.id || null;
    }

    const passwordHash = await bcrypt.hash(userData.password, 12);
    
    const isCitizen = userData.role === 'Citizen';
    const user = await prisma.user.create({
      data: {
        municipalityId,
        departmentId,
        supervisorId,
        email: userData.email,
        passwordHash,
        firstName: userData.firstName,
        lastName: userData.lastName,
        createdVia: 'PLATFORM_SEEDED',
        // Staff accounts seeded by the platform are auto-verified; citizen test
        // accounts stay UNVERIFIED so the KYC flow is exercisable in dev.
        verificationStatus: isCitizen ? 'UNVERIFIED' : 'VERIFIED',
        verifiedAt: isCitizen ? null : new Date(),
      },
    });

    // Assign role
    if (roleId) {
      await prisma.userRole.create({
        data: {
          userId: user.id,
          roleId,
        },
      });
    }

    console.log(`  ✓ Created ${userData.role}: ${userData.firstName} ${userData.lastName} (${userData.email})`);
  }
}

async function seedMunicipality() {
  console.log('\n=== Seeding Beirut Municipality ===\n');

  const municipality = await prisma.municipality.upsert({
    where: { code: 'BEI' },
    update: {
      // Backfill multilingual identity for existing rows
      nameAr: 'بلدية بيروت',
      nameFr: 'Municipalité de Beyrouth',
      description: 'Municipality of the capital Beirut, serving the citizens of the city.',
      descriptionAr: 'بلدية العاصمة بيروت، في خدمة سكان المدينة.',
      descriptionFr: 'Municipalité de la capitale Beyrouth, au service des citoyens de la ville.',
    },
    create: {
      name: 'Beirut Municipality',
      nameAr: 'بلدية بيروت',
      nameFr: 'Municipalité de Beyrouth',
      description: 'Municipality of the capital Beirut, serving the citizens of the city.',
      descriptionAr: 'بلدية العاصمة بيروت، في خدمة سكان المدينة.',
      descriptionFr: 'Municipalité de la capitale Beyrouth, au service des citoyens de la ville.',
      code: 'BEI',
      isActive: true,
    },
  });
  
  console.log(`Municipality: ${municipality.name} (${municipality.code})\n`);
  
  return municipality;
}

async function seedSuperAdmin() {
  console.log('\n=== Seeding Super Admin ===\n');
  const email = 'super@platform.local';
  const passwordHash = await bcrypt.hash('superadmin123', 10);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({
      where: { email },
      data: { isSuperAdmin: true, isActive: true, passwordHash },
    });
    console.log(`  ✓ Super Admin already existed (refreshed): ${email}`);
    return;
  }

  await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName: 'Platform',
      lastName: 'Administrator',
      isSuperAdmin: true,
      isActive: true,
      verificationStatus: 'VERIFIED',
      verifiedAt: new Date(),
      municipalityId: null,
      createdVia: 'PLATFORM_SEEDED',
    },
  });
  console.log(`  ✓ Created Super Admin: ${email}`);
}

/**
 * Back-fill the new positional slots (Municipality.adminUserId,
 * Department.headUserId) from existing role assignments. Picks ONE user
 * per slot (lowest createdAt = earliest seeded). Future role grants of
 * Admin/HOD must go through the position endpoints.
 */
async function backfillPositionalSlots(municipalityId: string) {
  console.log('\n=== Back-filling Positional Slots ===\n');

  // ── Municipality Admin ──
  const muni = await prisma.municipality.findUnique({
    where: { id: municipalityId },
  });
  if (muni && !muni.adminUserId) {
    const adminRole = await prisma.role.findFirst({
      where: { municipalityId, name: 'Admin', deletedAt: null },
    });
    if (adminRole) {
      const adminUser = await prisma.user.findFirst({
        where: {
          municipalityId,
          isActive: true,
          userRoles: { some: { roleId: adminRole.id } },
        },
        orderBy: { createdAt: 'asc' },
      });
      if (adminUser) {
        await prisma.municipality.update({
          where: { id: municipalityId },
          data: { adminUserId: adminUser.id },
        });
        console.log(`  ✓ Municipality Admin slot → ${adminUser.email}`);
      }
    }
  }

  // ── Department Heads ──
  const hodRole = await prisma.role.findFirst({
    where: { municipalityId, name: 'Head of Department', deletedAt: null },
  });
  if (hodRole) {
    const departments = await prisma.department.findMany({
      where: { municipalityId, deletedAt: null },
    });
    for (const dept of departments) {
      if (dept.headUserId) continue;
      const head = await prisma.user.findFirst({
        where: {
          municipalityId,
          departmentId: dept.id,
          isActive: true,
          userRoles: { some: { roleId: hodRole.id } },
        },
        orderBy: { createdAt: 'asc' },
      });
      if (head) {
        // Slot is globally unique — make sure no other dept already claimed them
        const collision = await prisma.department.findFirst({
          where: { headUserId: head.id },
        });
        if (!collision) {
          await prisma.department.update({
            where: { id: dept.id },
            data: { headUserId: head.id },
          });
          console.log(`  ✓ ${dept.name} HOD slot → ${head.email}`);
        }
      } else {
        console.log(`  ⚠ ${dept.name} has no HOD assigned (vacant slot)`);
      }
    }
  }
}

/**
 * Idempotent backfill: ensure every staff account (anyone whose `createdVia`
 * is not SELF_REGISTRATION, OR who holds any role other than "Citizen") is
 * marked as VERIFIED. Pure-citizen accounts that self-registered keep their
 * UNVERIFIED state so the KYC flow remains exercisable.
 */
async function backfillStaffKyc(municipalityId: string) {
  console.log('\n=== Back-filling Staff KYC ===\n');

  const stale = await prisma.user.findMany({
    where: {
      municipalityId,
      verificationStatus: { not: 'VERIFIED' },
      OR: [
        { createdVia: { not: 'SELF_REGISTRATION' } },
        { userRoles: { some: { role: { name: { not: 'Citizen' } } } } },
      ],
    },
    select: { id: true, email: true },
  });

  if (stale.length === 0) {
    console.log('  ✓ All staff already verified');
    return;
  }

  await prisma.user.updateMany({
    where: { id: { in: stale.map((u) => u.id) } },
    data: { verificationStatus: 'VERIFIED', verifiedAt: new Date() },
  });

  console.log(`  ✓ Auto-verified ${stale.length} staff account(s):`);
  for (const u of stale) console.log(`     - ${u.email}`);
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║     BALADIYATI - Municipality Complaint System Seed    ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  
  try {
    await seedPermissions();
    await seedSuperAdmin();
    const municipality = await seedMunicipality();
    await createRolesForMunicipality(municipality.id);
    await seedStarterTemplate(municipality.id);
    await seedUsers(municipality.id);
    await backfillPositionalSlots(municipality.id);
    await backfillStaffKyc(municipality.id);
    
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║                  SEED COMPLETED                        ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log('\n📋 Test Credentials:\n');
    console.log('  SUPER ADMIN (Platform-wide):');
    console.log('    Email: super@platform.local');
    console.log('    Password: superadmin123');
    console.log('\n  ADMIN:');
    console.log('    Email: admin@beirut.gov.lb');
    console.log('    Password: admin123');
    console.log('\n  HEAD OF DEPARTMENT (Roads):');
    console.log('    Email: hod.roads@beirut.gov.lb');
    console.log('    Password: hod123');
    console.log('\n  SUPERVISOR (Roads):');
    console.log('    Email: super.roads@beirut.gov.lb');
    console.log('    Password: super123');
    console.log('\n  FIELD WORKER (Roads):');
    console.log('    Email: worker1.roads@beirut.gov.lb');
    console.log('    Password: worker123');
    console.log('\n  CITIZEN:');
    console.log('    Email: citizen@test.com');
    console.log('    Password: citizen123');
    console.log('\n  Municipality Code: BEI');
    console.log('');
  } catch (error) {
    console.error('Seed failed:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
