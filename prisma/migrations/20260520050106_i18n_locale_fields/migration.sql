-- CreateEnum
CREATE TYPE "UserLocale" AS ENUM ('EN', 'AR', 'FR');

-- AlterTable
ALTER TABLE "complaint_categories" ADD COLUMN     "name_ar" TEXT,
ADD COLUMN     "name_fr" TEXT;

-- AlterTable
ALTER TABLE "departments" ADD COLUMN     "description_ar" TEXT,
ADD COLUMN     "description_fr" TEXT,
ADD COLUMN     "name_ar" TEXT,
ADD COLUMN     "name_fr" TEXT;

-- AlterTable
ALTER TABLE "municipalities" ADD COLUMN     "name_ar" TEXT,
ADD COLUMN     "name_fr" TEXT;

-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "description_ar" TEXT,
ADD COLUMN     "description_fr" TEXT,
ADD COLUMN     "name_ar" TEXT,
ADD COLUMN     "name_fr" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "locale" "UserLocale" NOT NULL DEFAULT 'EN';
