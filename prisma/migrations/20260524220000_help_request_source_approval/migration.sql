-- Two-sided help request workflow: source approval before receiver visibility.

ALTER TYPE "HelpRequestStatus" ADD VALUE IF NOT EXISTS 'PENDING_SOURCE_APPROVAL';
ALTER TYPE "HelpRequestStatus" ADD VALUE IF NOT EXISTS 'SOURCE_REJECTED';

ALTER TABLE "complaint_help_requests"
  ADD COLUMN IF NOT EXISTS "source_approved_by_id" TEXT,
  ADD COLUMN IF NOT EXISTS "source_approved_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "source_rejected_by_id" TEXT,
  ADD COLUMN IF NOT EXISTS "source_rejected_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "source_reject_reason" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'complaint_help_requests_source_approved_by_id_fkey'
  ) THEN
    ALTER TABLE "complaint_help_requests"
      ADD CONSTRAINT "complaint_help_requests_source_approved_by_id_fkey"
      FOREIGN KEY ("source_approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'complaint_help_requests_source_rejected_by_id_fkey'
  ) THEN
    ALTER TABLE "complaint_help_requests"
      ADD CONSTRAINT "complaint_help_requests_source_rejected_by_id_fkey"
      FOREIGN KEY ("source_rejected_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Existing open requests created under the old flow already reached the receiver;
-- leave them as PENDING (receiver-visible). No data loss.
