-- Repair stale complaint_assignments after cross-department transfers.
-- Does not delete rows; only sets is_active = false on invalid duplicates.

-- 1) More than one active assignment per complaint — keep newest only
UPDATE "complaint_assignments" AS ca
SET "is_active" = false
WHERE ca."is_active" = true
  AND ca."id" NOT IN (
    SELECT DISTINCT ON ("complaint_id") "id"
    FROM "complaint_assignments"
    WHERE "is_active" = true
    ORDER BY "complaint_id", "created_at" DESC
  );

-- 2) Active assignment whose assignee is not in the complaint's current department
UPDATE "complaint_assignments" AS ca
SET "is_active" = false
WHERE ca."is_active" = true
  AND EXISTS (
    SELECT 1
    FROM "complaints" AS c
    INNER JOIN "users" AS u ON u."id" = ca."assigned_to_id"
    WHERE c."id" = ca."complaint_id"
      AND c."department_id" IS NOT NULL
      AND u."department_id" IS NOT NULL
      AND c."department_id" <> u."department_id"
  );
