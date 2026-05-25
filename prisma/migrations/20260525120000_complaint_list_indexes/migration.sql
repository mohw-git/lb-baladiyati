-- Composite indexes for staff complaint list / bucket counts at scale.
CREATE INDEX IF NOT EXISTS "complaints_municipality_id_status_idx"
  ON "complaints"("municipality_id", "status");

CREATE INDEX IF NOT EXISTS "complaints_municipality_id_department_id_status_idx"
  ON "complaints"("municipality_id", "department_id", "status");

CREATE INDEX IF NOT EXISTS "complaints_municipality_id_department_id_due_date_idx"
  ON "complaints"("municipality_id", "department_id", "due_date");

CREATE INDEX IF NOT EXISTS "complaint_assignments_assigned_to_id_is_active_idx"
  ON "complaint_assignments"("assigned_to_id", "is_active");

CREATE INDEX IF NOT EXISTS "complaint_assignments_complaint_id_is_active_idx"
  ON "complaint_assignments"("complaint_id", "is_active");
