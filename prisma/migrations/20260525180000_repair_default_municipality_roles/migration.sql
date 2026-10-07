-- Repair default municipal roles that were created without platform protection
-- (e.g. via createMunicipality before provisionDefaultMunicipalityRoles).
--
-- Diagnostic (run before/after in psql):
--   SELECT municipality_id, name, priority, is_system, is_system_managed
--   FROM roles
--   WHERE deleted_at IS NULL
--     AND name IN (
--       'Admin', 'Head of Department', 'Supervisor', 'Field Worker',
--       'Assigner', 'Verifier', 'Citizen'
--     )
--   ORDER BY municipality_id, priority DESC;

UPDATE roles
SET
  priority = CASE name
    WHEN 'Citizen' THEN 0
    WHEN 'Field Worker' THEN 30
    WHEN 'Verifier' THEN 50
    WHEN 'Assigner' THEN 50
    WHEN 'Supervisor' THEN 60
    WHEN 'Head of Department' THEN 80
    WHEN 'Admin' THEN 100
    ELSE priority
  END,
  is_system = true,
  is_system_managed = CASE name
    WHEN 'Admin' THEN true
    WHEN 'Head of Department' THEN true
    ELSE false
  END
WHERE deleted_at IS NULL
  AND name IN (
    'Admin',
    'Head of Department',
    'Supervisor',
    'Field Worker',
    'Assigner',
    'Verifier',
    'Citizen'
  )
  AND (
    is_system = false
    OR (name <> 'Citizen' AND priority = 0)
    OR (name = 'Admin' AND is_system_managed = false)
    OR (name = 'Head of Department' AND is_system_managed = false)
  );
