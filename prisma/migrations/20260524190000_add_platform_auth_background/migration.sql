-- AlterTable
ALTER TABLE "platform_branding" ADD COLUMN "auth_background_image_url" TEXT;
ALTER TABLE "platform_branding" ADD COLUMN "auth_background_focal_x" DOUBLE PRECISION DEFAULT 50;
ALTER TABLE "platform_branding" ADD COLUMN "auth_background_focal_y" DOUBLE PRECISION DEFAULT 50;
ALTER TABLE "platform_branding" ADD COLUMN "auth_background_overlay_opacity" DOUBLE PRECISION;
