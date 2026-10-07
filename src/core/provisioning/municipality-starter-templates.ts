import { Prisma } from '@prisma/client';

export enum MunicipalityStarterTemplate {
  FULL_GOVERNMENT = 'FULL_GOVERNMENT',
  DEPARTMENTS_ONLY = 'DEPARTMENTS_ONLY',
  BLANK = 'BLANK',
}

export const DEFAULT_STARTER_TEMPLATE = MunicipalityStarterTemplate.FULL_GOVERNMENT;

export type StarterDepartmentSeed = {
  name: string;
  nameAr: string;
  nameFr: string;
  description: string;
  descriptionAr: string;
  descriptionFr: string;
};

export type StarterCategorySeed = {
  name: string;
  nameAr: string;
  nameFr: string;
  icon: string;
  /** Canonical English department name; null = no department link */
  department: string | null;
};

export const STANDARD_STARTER_DEPARTMENTS: readonly StarterDepartmentSeed[] = [
  {
    name: 'Roads & Infrastructure',
    nameAr: 'الطرق والبنية التحتية',
    nameFr: 'Voirie et infrastructure',
    description: 'Handles roads, bridges, sidewalks, potholes',
    descriptionAr: 'إدارة الطرق والجسور والأرصفة وإصلاح الحفر.',
    descriptionFr: 'Gestion des routes, ponts, trottoirs et nids-de-poule.',
  },
  {
    name: 'Public Works',
    nameAr: 'الأشغال العامة',
    nameFr: 'Travaux publics',
    description: 'Street lights, traffic signs, public facilities',
    descriptionAr: 'إنارة الشوارع وإشارات المرور والمرافق العامة.',
    descriptionFr: 'Éclairage public, panneaux routiers, équipements publics.',
  },
  {
    name: 'Sanitation',
    nameAr: 'الصحة العامة والنظافة',
    nameFr: 'Hygiène publique',
    description: 'Garbage collection, sewage, public cleaning',
    descriptionAr: 'جمع النفايات وتصريف الصرف الصحي والنظافة العامة.',
    descriptionFr: 'Collecte des déchets, assainissement et nettoyage public.',
  },
  {
    name: 'Water Authority',
    nameAr: 'مصلحة المياه',
    nameFr: 'Régie des eaux',
    description: 'Water supply, pipes, drainage',
    descriptionAr: 'توزيع المياه والشبكات والتصريف.',
    descriptionFr: "Adduction d'eau, canalisations et drainage.",
  },
  {
    name: 'Parks & Recreation',
    nameAr: 'الحدائق والترفيه',
    nameFr: 'Parcs et loisirs',
    description: 'Parks, green spaces, playgrounds',
    descriptionAr: 'الحدائق العامة والمساحات الخضراء والملاعب.',
    descriptionFr: 'Parcs publics, espaces verts et aires de jeux.',
  },
  {
    name: 'Public Safety',
    nameAr: 'السلامة العامة',
    nameFr: 'Sécurité publique',
    description: 'Safety hazards, emergency issues',
    descriptionAr: 'الأخطار العامة والحالات الطارئة.',
    descriptionFr: 'Risques publics et situations d\'urgence.',
  },
] as const;

export const STANDARD_STARTER_CATEGORIES: readonly StarterCategorySeed[] = [
  { name: 'Potholes', nameAr: 'حفر الطرق', nameFr: 'Nids-de-poule', icon: 'road', department: 'Roads & Infrastructure' },
  { name: 'Road Damage', nameAr: 'تلف الطرق', nameFr: 'Dégradation routière', icon: 'construction', department: 'Roads & Infrastructure' },
  { name: 'Sidewalk Issues', nameAr: 'مشاكل الأرصفة', nameFr: 'Problèmes de trottoir', icon: 'walk', department: 'Roads & Infrastructure' },
  { name: 'Street Lights', nameAr: 'إنارة الشوارع', nameFr: 'Éclairage public', icon: 'lightbulb', department: 'Public Works' },
  { name: 'Traffic Signs', nameAr: 'إشارات المرور', nameFr: 'Panneaux de signalisation', icon: 'traffic', department: 'Public Works' },
  { name: 'Public Facilities', nameAr: 'المرافق العامة', nameFr: 'Équipements publics', icon: 'building', department: 'Public Works' },
  { name: 'Garbage Collection', nameAr: 'جمع النفايات', nameFr: 'Collecte des déchets', icon: 'trash', department: 'Sanitation' },
  { name: 'Sewage Issues', nameAr: 'مشاكل الصرف الصحي', nameFr: "Problèmes d'assainissement", icon: 'pipe', department: 'Sanitation' },
  { name: 'Street Cleaning', nameAr: 'تنظيف الشوارع', nameFr: 'Nettoyage des rues', icon: 'broom', department: 'Sanitation' },
  { name: 'Water Supply', nameAr: 'إمداد المياه', nameFr: "Adduction d'eau", icon: 'water', department: 'Water Authority' },
  { name: 'Water Leak', nameAr: 'تسرب المياه', nameFr: "Fuite d'eau", icon: 'droplet', department: 'Water Authority' },
  { name: 'Drainage Problems', nameAr: 'مشاكل التصريف', nameFr: 'Problèmes de drainage', icon: 'drain', department: 'Water Authority' },
  { name: 'Park Maintenance', nameAr: 'صيانة الحدائق', nameFr: 'Entretien des parcs', icon: 'tree', department: 'Parks & Recreation' },
  { name: 'Playground Issues', nameAr: 'مشاكل الملاعب', nameFr: "Problèmes d'aires de jeux", icon: 'play', department: 'Parks & Recreation' },
  { name: 'Safety Hazard', nameAr: 'خطر على السلامة', nameFr: 'Danger pour la sécurité', icon: 'alert', department: 'Public Safety' },
  { name: 'Noise Complaint', nameAr: 'شكوى ضوضاء', nameFr: 'Nuisance sonore', icon: 'volume', department: 'Public Safety' },
  { name: 'Other', nameAr: 'أخرى', nameFr: 'Autre', icon: 'more', department: null },
] as const;

type DbClient = {
  department: Prisma.TransactionClient['department'];
  complaintCategory: Prisma.TransactionClient['complaintCategory'];
};

export type StarterApplyResult = {
  departmentsCreated: number;
  departmentsUpdated: number;
  categoriesCreated: number;
  categoriesUpdated: number;
};

function templateIncludesDepartments(template: MunicipalityStarterTemplate): boolean {
  return (
    template === MunicipalityStarterTemplate.FULL_GOVERNMENT ||
    template === MunicipalityStarterTemplate.DEPARTMENTS_ONLY
  );
}

function templateIncludesCategories(template: MunicipalityStarterTemplate): boolean {
  return template === MunicipalityStarterTemplate.FULL_GOVERNMENT;
}

export async function upsertStarterDepartments(
  db: DbClient,
  municipalityId: string,
): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;

  for (const dept of STANDARD_STARTER_DEPARTMENTS) {
    const existing = await db.department.findUnique({
      where: {
        municipalityId_name: { municipalityId, name: dept.name },
      },
      select: { id: true },
    });

    await db.department.upsert({
      where: {
        municipalityId_name: { municipalityId, name: dept.name },
      },
      update: {
        nameAr: dept.nameAr,
        nameFr: dept.nameFr,
        description: dept.description,
        descriptionAr: dept.descriptionAr,
        descriptionFr: dept.descriptionFr,
      },
      create: {
        municipalityId,
        name: dept.name,
        nameAr: dept.nameAr,
        nameFr: dept.nameFr,
        description: dept.description,
        descriptionAr: dept.descriptionAr,
        descriptionFr: dept.descriptionFr,
      },
    });

    if (existing) updated += 1;
    else created += 1;
  }

  return { created, updated };
}

export async function upsertStarterCategories(
  db: DbClient,
  municipalityId: string,
): Promise<{ created: number; updated: number }> {
  const departments = await db.department.findMany({
    where: { municipalityId },
    select: { id: true, name: true },
  });
  const deptMap = new Map(departments.map((d) => [d.name, d.id]));

  let created = 0;
  let updated = 0;

  for (const cat of STANDARD_STARTER_CATEGORIES) {
    const departmentId = cat.department ? deptMap.get(cat.department) ?? null : null;

    const existing = await db.complaintCategory.findUnique({
      where: {
        municipalityId_name: { municipalityId, name: cat.name },
      },
      select: { id: true },
    });

    await db.complaintCategory.upsert({
      where: {
        municipalityId_name: { municipalityId, name: cat.name },
      },
      update: {
        nameAr: cat.nameAr,
        nameFr: cat.nameFr,
        icon: cat.icon,
        departmentId,
      },
      create: {
        municipalityId,
        name: cat.name,
        nameAr: cat.nameAr,
        nameFr: cat.nameFr,
        icon: cat.icon,
        departmentId,
      },
    });

    if (existing) updated += 1;
    else created += 1;
  }

  return { created, updated };
}

/**
 * Apply departments and/or categories from a starter template.
 * Uses upsert on (municipalityId, name) — safe to call multiple times.
 */
export async function applyMunicipalityStarterTemplate(
  db: DbClient,
  municipalityId: string,
  template: MunicipalityStarterTemplate,
): Promise<StarterApplyResult> {
  const result: StarterApplyResult = {
    departmentsCreated: 0,
    departmentsUpdated: 0,
    categoriesCreated: 0,
    categoriesUpdated: 0,
  };

  if (template === MunicipalityStarterTemplate.BLANK) {
    return result;
  }

  if (templateIncludesDepartments(template)) {
    const dept = await upsertStarterDepartments(db, municipalityId);
    result.departmentsCreated = dept.created;
    result.departmentsUpdated = dept.updated;
  }

  if (templateIncludesCategories(template)) {
    const cats = await upsertStarterCategories(db, municipalityId);
    result.categoriesCreated = cats.created;
    result.categoriesUpdated = cats.updated;
  }

  return result;
}

/** Apply standard complaint categories only (existing municipalities with departments). */
export async function applyMunicipalityStarterCategoriesOnly(
  db: DbClient,
  municipalityId: string,
): Promise<Pick<StarterApplyResult, 'categoriesCreated' | 'categoriesUpdated'>> {
  const cats = await upsertStarterCategories(db, municipalityId);
  return {
    categoriesCreated: cats.created,
    categoriesUpdated: cats.updated,
  };
}
