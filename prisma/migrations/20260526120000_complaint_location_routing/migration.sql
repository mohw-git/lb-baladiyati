-- Incident-location routing metadata + optional municipality boundaries.

CREATE TABLE "municipality_boundaries" (
    "id" TEXT NOT NULL,
    "municipality_id" TEXT NOT NULL,
    "geojson" JSONB NOT NULL,
    "buffer_meters" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "municipality_boundaries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "municipality_boundaries_municipality_id_key" ON "municipality_boundaries"("municipality_id");
CREATE INDEX "municipality_boundaries_municipality_id_idx" ON "municipality_boundaries"("municipality_id");

ALTER TABLE "municipality_boundaries" ADD CONSTRAINT "municipality_boundaries_municipality_id_fkey" FOREIGN KEY ("municipality_id") REFERENCES "municipalities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "complaints" ADD COLUMN "reporter_registered_municipality_id" TEXT,
ADD COLUMN "municipality_resolution_method" TEXT,
ADD COLUMN "municipality_resolution_candidates" JSONB,
ADD COLUMN "location_resolved_at" TIMESTAMP(3);

CREATE INDEX "complaints_reporter_registered_municipality_id_idx" ON "complaints"("reporter_registered_municipality_id");

ALTER TABLE "complaints" ADD CONSTRAINT "complaints_reporter_registered_municipality_id_fkey" FOREIGN KEY ("reporter_registered_municipality_id") REFERENCES "municipalities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill legacy rows: operational muni was always the reporter's registered muni.
UPDATE "complaints" c
SET
  "reporter_registered_municipality_id" = u."municipality_id",
  "municipality_resolution_method" = 'LEGACY_USER_MUNICIPALITY'
FROM "users" u
WHERE c."created_by_id" = u."id"
  AND c."reporter_registered_municipality_id" IS NULL;
