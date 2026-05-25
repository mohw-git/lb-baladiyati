-- Complaint workflow stabilization pass.
-- Two changes:
--   1) Add complaint_status_logs.event_kind so help/transfer/reassignment
--      events no longer have to be written as fake same-status transitions.
--      Existing rows remain status transitions (event_kind = NULL).
--   2) Repair stale active assignments on terminal complaints. Backend now
--      deactivates them inside the same transaction as the terminal status
--      change; this migration cleans up historic rows so worker workload
--      counts and "Assigned to me" lists match reality.
--
-- Safe to re-run: only flips is_active = false and adds a nullable column.

-- ── 1) event_kind discriminator on complaint_status_logs ────────────
ALTER TABLE "complaint_status_logs"
  ADD COLUMN IF NOT EXISTS "event_kind" TEXT;

-- ── 2) Deactivate stale active assignments on terminal complaints ───
UPDATE "complaint_assignments" AS ca
SET "is_active" = false
FROM "complaints" AS c
WHERE c."id" = ca."complaint_id"
  AND ca."is_active" = true
  AND c."status" IN ('COMPLETED', 'REJECTED', 'CLOSED');
