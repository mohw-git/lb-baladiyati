-- CreateEnum
CREATE TYPE "PlatformAnnouncementStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "platform_announcements" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "title_ar" TEXT,
    "title_fr" TEXT,
    "summary" TEXT NOT NULL,
    "summary_ar" TEXT,
    "summary_fr" TEXT,
    "content" TEXT NOT NULL,
    "content_ar" TEXT,
    "content_fr" TEXT,
    "image_url" TEXT,
    "status" "PlatformAnnouncementStatus" NOT NULL DEFAULT 'DRAFT',
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "publish_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_by_id" TEXT NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_announcements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "platform_announcements_status_idx" ON "platform_announcements"("status");
CREATE INDEX "platform_announcements_publish_at_idx" ON "platform_announcements"("publish_at");
CREATE INDEX "platform_announcements_expires_at_idx" ON "platform_announcements"("expires_at");
CREATE INDEX "platform_announcements_is_pinned_priority_idx" ON "platform_announcements"("is_pinned", "priority");

-- AddForeignKey
ALTER TABLE "platform_announcements" ADD CONSTRAINT "platform_announcements_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
