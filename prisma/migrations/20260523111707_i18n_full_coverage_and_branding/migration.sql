-- AlterTable
ALTER TABLE "complaint_categories" ADD COLUMN     "description" TEXT,
ADD COLUMN     "description_ar" TEXT,
ADD COLUMN     "description_fr" TEXT;

-- AlterTable
ALTER TABLE "municipalities" ADD COLUMN     "banner_image_url" TEXT,
ADD COLUMN     "banner_overlay_color" TEXT,
ADD COLUMN     "banner_overlay_opacity" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "news_posts" ADD COLUMN     "content_ar" TEXT,
ADD COLUMN     "content_fr" TEXT,
ADD COLUMN     "title_ar" TEXT,
ADD COLUMN     "title_fr" TEXT;

-- AlterTable
ALTER TABLE "permissions" ADD COLUMN     "name_ar" TEXT,
ADD COLUMN     "name_fr" TEXT;
