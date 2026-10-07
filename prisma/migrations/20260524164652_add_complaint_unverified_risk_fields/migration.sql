-- AlterTable
ALTER TABLE "complaints" ADD COLUMN     "is_risky_submission" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "risk_reasons" JSONB,
ADD COLUMN     "submitted_by_email_verified" BOOLEAN,
ADD COLUMN     "submitted_by_kyc_verified" BOOLEAN;

-- CreateIndex
CREATE INDEX "complaints_is_risky_submission_idx" ON "complaints"("is_risky_submission");
