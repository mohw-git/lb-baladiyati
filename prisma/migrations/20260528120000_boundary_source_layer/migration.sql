-- CreateEnum
CREATE TYPE "BoundarySourceImportStatus" AS ENUM ('IMPORTING', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MunicipalityBoundarySourceType" AS ENUM ('AUTO_FROM_SOURCE', 'MANUAL_GEOJSON');

-- AlterTable
ALTER TABLE "municipalities" ADD COLUMN "boundary_color" TEXT;

-- AlterTable
ALTER TABLE "municipality_boundaries" ADD COLUMN "source_type" "MunicipalityBoundarySourceType" NOT NULL DEFAULT 'MANUAL_GEOJSON',
ADD COLUMN "source_import_id" TEXT,
ADD COLUMN "last_generated_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "boundary_source_imports" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "valid_on" TEXT,
    "version" TEXT,
    "feature_count" INTEGER NOT NULL DEFAULT 0,
    "status" "BoundarySourceImportStatus" NOT NULL DEFAULT 'IMPORTING',
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "imported_by_user_id" TEXT,

    CONSTRAINT "boundary_source_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boundary_source_features" (
    "id" TEXT NOT NULL,
    "import_id" TEXT NOT NULL,
    "feature_key" TEXT NOT NULL,
    "adm3_name" TEXT NOT NULL,
    "adm3_name1" TEXT,
    "adm3_pcode" TEXT NOT NULL,
    "adm2_name" TEXT NOT NULL,
    "adm1_name" TEXT NOT NULL,
    "area_sqkm" DOUBLE PRECISION,
    "center_lat" DOUBLE PRECISION,
    "center_lon" DOUBLE PRECISION,
    "geometry" JSONB NOT NULL,

    CONSTRAINT "boundary_source_features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boundary_source_assignments" (
    "id" TEXT NOT NULL,
    "feature_id" TEXT NOT NULL,
    "municipality_id" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by_user_id" TEXT,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "boundary_source_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "boundary_source_imports_status_idx" ON "boundary_source_imports"("status");

-- CreateIndex
CREATE UNIQUE INDEX "boundary_source_features_import_id_feature_key_key" ON "boundary_source_features"("import_id", "feature_key");

-- CreateIndex
CREATE INDEX "boundary_source_features_import_id_idx" ON "boundary_source_features"("import_id");

-- CreateIndex
CREATE INDEX "boundary_source_features_adm3_pcode_idx" ON "boundary_source_features"("adm3_pcode");

-- CreateIndex
CREATE INDEX "boundary_source_assignments_feature_id_revoked_at_idx" ON "boundary_source_assignments"("feature_id", "revoked_at");

-- CreateIndex
CREATE INDEX "boundary_source_assignments_municipality_id_revoked_at_idx" ON "boundary_source_assignments"("municipality_id", "revoked_at");

-- CreateIndex
CREATE INDEX "municipality_boundaries_source_import_id_idx" ON "municipality_boundaries"("source_import_id");

-- AddForeignKey
ALTER TABLE "municipality_boundaries" ADD CONSTRAINT "municipality_boundaries_source_import_id_fkey" FOREIGN KEY ("source_import_id") REFERENCES "boundary_source_imports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boundary_source_imports" ADD CONSTRAINT "boundary_source_imports_imported_by_user_id_fkey" FOREIGN KEY ("imported_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boundary_source_features" ADD CONSTRAINT "boundary_source_features_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "boundary_source_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boundary_source_assignments" ADD CONSTRAINT "boundary_source_assignments_feature_id_fkey" FOREIGN KEY ("feature_id") REFERENCES "boundary_source_features"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boundary_source_assignments" ADD CONSTRAINT "boundary_source_assignments_municipality_id_fkey" FOREIGN KEY ("municipality_id") REFERENCES "municipalities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boundary_source_assignments" ADD CONSTRAINT "boundary_source_assignments_assigned_by_user_id_fkey" FOREIGN KEY ("assigned_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill existing boundaries as manual
UPDATE "municipality_boundaries" SET "source_type" = 'MANUAL_GEOJSON' WHERE "source_type" IS NULL;
