-- CreateEnum
CREATE TYPE "PlatformBroadcastAudience" AS ENUM ('ALL_USERS', 'CITIZENS', 'STAFF', 'MUNICIPALITIES', 'ROLES', 'USERS');

-- CreateEnum
CREATE TYPE "PlatformBroadcastChannel" AS ENUM ('IN_APP', 'PUSH', 'BOTH');

-- CreateEnum
CREATE TYPE "PlatformBroadcastStatus" AS ENUM ('SCHEDULED', 'SENDING', 'SENT', 'FAILED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'PLATFORM_BROADCAST';

-- DropIndex
DROP INDEX "complaint_assignments_assigned_to_id_is_active_idx";

-- DropIndex
DROP INDEX "complaint_assignments_complaint_id_is_active_idx";

-- DropIndex
DROP INDEX "complaints_municipality_id_department_id_due_date_idx";

-- DropIndex
DROP INDEX "complaints_municipality_id_department_id_status_idx";

-- DropIndex
DROP INDEX "complaints_municipality_id_status_idx";

-- DropIndex
DROP INDEX "complaints_reporter_registered_municipality_id_idx";

-- AlterTable
ALTER TABLE "complaint_help_requests" ALTER COLUMN "status" SET DEFAULT 'PENDING_SOURCE_APPROVAL';

-- AlterTable
ALTER TABLE "platform_branding" ALTER COLUMN "platform_name" SET DEFAULT 'Baladiyati',
ALTER COLUMN "platform_name_ar" SET DEFAULT 'بلديتي',
ALTER COLUMN "platform_name_fr" SET DEFAULT 'Baladiyati';

-- CreateTable
CREATE TABLE "platform_broadcasts" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "deep_link" TEXT,
    "audience" "PlatformBroadcastAudience" NOT NULL,
    "audience_config" JSONB,
    "channels" "PlatformBroadcastChannel" NOT NULL,
    "status" "PlatformBroadcastStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduled_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "recipient_count" INTEGER,
    "idempotency_key" TEXT,
    "failure_reason" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_broadcasts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_broadcasts_idempotency_key_key" ON "platform_broadcasts"("idempotency_key");

-- CreateIndex
CREATE INDEX "platform_broadcasts_status_scheduled_at_idx" ON "platform_broadcasts"("status", "scheduled_at");

-- CreateIndex
CREATE INDEX "platform_broadcasts_created_at_idx" ON "platform_broadcasts"("created_at");

-- AddForeignKey
ALTER TABLE "platform_broadcasts" ADD CONSTRAINT "platform_broadcasts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
