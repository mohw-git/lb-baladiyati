-- CreateEnum
CREATE TYPE "HelpRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'IN_PROGRESS', 'SUBMITTED', 'COMPLETED', 'DECLINED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "complaint_help_requests" (
    "id" TEXT NOT NULL,
    "municipality_id" TEXT NOT NULL,
    "complaint_id" TEXT NOT NULL,
    "from_department_id" TEXT NOT NULL,
    "to_department_id" TEXT NOT NULL,
    "requested_by_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "HelpRequestStatus" NOT NULL DEFAULT 'PENDING',
    "responded_by_id" TEXT,
    "responded_at" TIMESTAMP(3),
    "response_reason" TEXT,
    "helper_assignee_id" TEXT,
    "submitted_by_id" TEXT,
    "submitted_at" TIMESTAMP(3),
    "solution_notes" TEXT,
    "solution_attachments" JSONB,
    "closed_by_id" TEXT,
    "closed_at" TIMESTAMP(3),
    "close_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "complaint_help_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "complaint_help_requests_municipality_id_idx" ON "complaint_help_requests"("municipality_id");

-- CreateIndex
CREATE INDEX "complaint_help_requests_complaint_id_idx" ON "complaint_help_requests"("complaint_id");

-- CreateIndex
CREATE INDEX "complaint_help_requests_to_department_id_status_idx" ON "complaint_help_requests"("to_department_id", "status");

-- CreateIndex
CREATE INDEX "complaint_help_requests_from_department_id_status_idx" ON "complaint_help_requests"("from_department_id", "status");

-- CreateIndex
CREATE INDEX "complaint_help_requests_helper_assignee_id_status_idx" ON "complaint_help_requests"("helper_assignee_id", "status");

-- AddForeignKey
ALTER TABLE "complaint_help_requests" ADD CONSTRAINT "complaint_help_requests_municipality_id_fkey" FOREIGN KEY ("municipality_id") REFERENCES "municipalities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_help_requests" ADD CONSTRAINT "complaint_help_requests_complaint_id_fkey" FOREIGN KEY ("complaint_id") REFERENCES "complaints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_help_requests" ADD CONSTRAINT "complaint_help_requests_from_department_id_fkey" FOREIGN KEY ("from_department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_help_requests" ADD CONSTRAINT "complaint_help_requests_to_department_id_fkey" FOREIGN KEY ("to_department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_help_requests" ADD CONSTRAINT "complaint_help_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_help_requests" ADD CONSTRAINT "complaint_help_requests_responded_by_id_fkey" FOREIGN KEY ("responded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_help_requests" ADD CONSTRAINT "complaint_help_requests_helper_assignee_id_fkey" FOREIGN KEY ("helper_assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_help_requests" ADD CONSTRAINT "complaint_help_requests_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_help_requests" ADD CONSTRAINT "complaint_help_requests_closed_by_id_fkey" FOREIGN KEY ("closed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
