import {
  MunicipalityStarterTemplate,
  STANDARD_STARTER_CATEGORIES,
  STANDARD_STARTER_DEPARTMENTS,
  applyMunicipalityStarterTemplate,
  upsertStarterCategories,
  upsertStarterDepartments,
} from './municipality-starter-templates';

function createMockDb() {
  const departments = new Map<string, { id: string; municipalityId: string; name: string }>();
  const categories = new Map<string, { id: string; municipalityId: string; name: string; departmentId: string | null }>();
  let deptSeq = 0;
  let catSeq = 0;

  const deptKey = (municipalityId: string, name: string) => `${municipalityId}::${name}`;
  const catKey = (municipalityId: string, name: string) => `${municipalityId}::${name}`;

  return {
    departments,
    categories,
    db: {
      department: {
        findUnique: async ({
          where,
        }: {
          where: { municipalityId_name: { municipalityId: string; name: string } };
        }) => {
          const row = departments.get(deptKey(where.municipalityId_name.municipalityId, where.municipalityId_name.name));
          return row ? { id: row.id } : null;
        },
        findMany: async ({ where }: { where: { municipalityId: string } }) => {
          return [...departments.values()]
            .filter((d) => d.municipalityId === where.municipalityId)
            .map((d) => ({ id: d.id, name: d.name }));
        },
        upsert: async ({
          where,
          create,
          update,
        }: {
          where: { municipalityId_name: { municipalityId: string; name: string } };
          create: { municipalityId: string; name: string };
          update: Record<string, unknown>;
        }) => {
          const key = deptKey(where.municipalityId_name.municipalityId, where.municipalityId_name.name);
          const existing = departments.get(key);
          if (existing) {
            return existing;
          }
          const row = {
            id: `dept-${++deptSeq}`,
            municipalityId: create.municipalityId,
            name: create.name,
          };
          departments.set(key, row);
          return row;
        },
      },
      complaintCategory: {
        findUnique: async ({
          where,
        }: {
          where: { municipalityId_name: { municipalityId: string; name: string } };
        }) => {
          const row = categories.get(catKey(where.municipalityId_name.municipalityId, where.municipalityId_name.name));
          return row ? { id: row.id } : null;
        },
        upsert: async ({
          where,
          create,
        }: {
          where: { municipalityId_name: { municipalityId: string; name: string } };
          create: { municipalityId: string; name: string; departmentId: string | null };
          update: { departmentId: string | null };
        }) => {
          const key = catKey(where.municipalityId_name.municipalityId, where.municipalityId_name.name);
          const existing = categories.get(key);
          if (existing) {
            existing.departmentId = create.departmentId;
            return existing;
          }
          const row = {
            id: `cat-${++catSeq}`,
            municipalityId: create.municipalityId,
            name: create.name,
            departmentId: create.departmentId,
          };
          categories.set(key, row);
          return row;
        },
      },
    },
  };
}

describe('municipality-starter-templates', () => {
  const municipalityId = 'muni-test-1';

  it('FULL_GOVERNMENT creates departments and categories', async () => {
    const { db, departments, categories } = createMockDb();
    const result = await applyMunicipalityStarterTemplate(
      db as any,
      municipalityId,
      MunicipalityStarterTemplate.FULL_GOVERNMENT,
    );

    expect(departments.size).toBe(STANDARD_STARTER_DEPARTMENTS.length);
    expect(categories.size).toBe(STANDARD_STARTER_CATEGORIES.length);
    expect(result.departmentsCreated).toBe(STANDARD_STARTER_DEPARTMENTS.length);
    expect(result.categoriesCreated).toBe(STANDARD_STARTER_CATEGORIES.length);
  });

  it('DEPARTMENTS_ONLY creates departments but no categories', async () => {
    const { db, departments, categories } = createMockDb();
    const result = await applyMunicipalityStarterTemplate(
      db as any,
      municipalityId,
      MunicipalityStarterTemplate.DEPARTMENTS_ONLY,
    );

    expect(departments.size).toBe(STANDARD_STARTER_DEPARTMENTS.length);
    expect(categories.size).toBe(0);
    expect(result.categoriesCreated).toBe(0);
  });

  it('BLANK creates nothing', async () => {
    const { db, departments, categories } = createMockDb();
    const result = await applyMunicipalityStarterTemplate(
      db as any,
      municipalityId,
      MunicipalityStarterTemplate.BLANK,
    );

    expect(departments.size).toBe(0);
    expect(categories.size).toBe(0);
    expect(result).toEqual({
      departmentsCreated: 0,
      departmentsUpdated: 0,
      categoriesCreated: 0,
      categoriesUpdated: 0,
    });
  });

  it('duplicate apply does not create duplicate rows', async () => {
    const { db, departments, categories } = createMockDb();
    await applyMunicipalityStarterTemplate(db as any, municipalityId, MunicipalityStarterTemplate.FULL_GOVERNMENT);
    const second = await applyMunicipalityStarterTemplate(
      db as any,
      municipalityId,
      MunicipalityStarterTemplate.FULL_GOVERNMENT,
    );

    expect(departments.size).toBe(STANDARD_STARTER_DEPARTMENTS.length);
    expect(categories.size).toBe(STANDARD_STARTER_CATEGORIES.length);
    expect(second.departmentsCreated).toBe(0);
    expect(second.categoriesCreated).toBe(0);
    expect(second.departmentsUpdated).toBe(STANDARD_STARTER_DEPARTMENTS.length);
    expect(second.categoriesUpdated).toBe(STANDARD_STARTER_CATEGORIES.length);
  });

  it('categories link to departments in the same municipality', async () => {
    const { db, categories } = createMockDb();
    await upsertStarterDepartments(db as any, municipalityId);
    await upsertStarterCategories(db as any, municipalityId);

    const potholes = categories.get(`${municipalityId}::Potholes`);
    expect(potholes?.departmentId).toBeTruthy();
    const other = categories.get(`${municipalityId}::Other`);
    expect(other?.departmentId).toBeNull();
  });
});
