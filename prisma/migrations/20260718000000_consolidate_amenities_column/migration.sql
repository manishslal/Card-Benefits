-- Consolidate amenities and detail_amenities into single column.
-- Strategy: merge amenities → detail_amenities (where detail_amenities is null),
-- then drop old amenities, rename detail_amenities → amenities.

-- 1. Copy the 9 seeded rows from amenities into detail_amenities where detail_amenities is null
UPDATE "lounges"
SET "detail_amenities" = "amenities"
WHERE "amenities" IS NOT NULL AND "detail_amenities" IS NULL;

-- 2. Where both exist, merge: detail_amenities takes priority, amenities fills gaps
UPDATE "lounges"
SET "detail_amenities" = "amenities" || "detail_amenities"
WHERE "amenities" IS NOT NULL AND "detail_amenities" IS NOT NULL;

-- 3. Drop the old amenities column
ALTER TABLE "lounges" DROP COLUMN "amenities";

-- 4. Rename detail_amenities to amenities
ALTER TABLE "lounges" RENAME COLUMN "detail_amenities" TO "amenities";
