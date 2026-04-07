-- Migration: Update resetCadence to Phase 6 Format
-- Date: 2026-04-07
-- Purpose: Convert legacy cadence values to new Phase 6 format
-- 
-- Mapping:
--   CalendarYear    → ANNUAL (48 benefits)
--   CardmemberYear  → ANNUAL (1 benefit)
--   FirstYear       → CUSTOM (2 benefits - one-time only)
--   TripBased       → CUSTOM (8 benefits - per-trip insurance)
--   None            → CUSTOM (7 benefits - ongoing rates, protections)
--
-- Total: 65 benefits affected

BEGIN TRANSACTION;

-- Update 1: CalendarYear → ANNUAL (most common)
UPDATE "MasterBenefit"
SET "resetCadence" = 'ANNUAL'
WHERE "resetCadence" = 'CalendarYear';

-- Update 2: CardmemberYear → ANNUAL (card anniversary-based annual reset)
UPDATE "MasterBenefit"
SET "resetCadence" = 'ANNUAL'
WHERE "resetCadence" = 'CardmemberYear';

-- Update 3: FirstYear → CUSTOM (one-time first-year credits)
UPDATE "MasterBenefit"
SET "resetCadence" = 'CUSTOM'
WHERE "resetCadence" = 'FirstYear';

-- Update 4: TripBased → CUSTOM (per-trip insurance, not calendar-based)
UPDATE "MasterBenefit"
SET "resetCadence" = 'CUSTOM'
WHERE "resetCadence" = 'TripBased';

-- Update 5: None → CUSTOM (non-resetting benefits: points, protections, perks)
UPDATE "MasterBenefit"
SET "resetCadence" = 'CUSTOM'
WHERE "resetCadence" = 'None';

-- Verification: All cadences should now be valid (ANNUAL, MONTHLY, QUARTERLY, SEMI_ANNUAL, CUSTOM)
-- Run this after transaction completes to verify success:
-- SELECT DISTINCT "resetCadence" FROM "MasterBenefit"
-- ORDER BY "resetCadence";
-- 
-- Expected output (4 rows):
--   ANNUAL
--   CUSTOM
--   MONTHLY (0 benefits)
--   QUARTERLY (0 benefits)
--   SEMI_ANNUAL (0 benefits)

COMMIT;

-- Post-migration verification queries:

-- Check 1: Verify all old cadences are gone
SELECT COUNT(*) as "invalid_cadences"
FROM "MasterBenefit"
WHERE "resetCadence" IN ('CalendarYear', 'CardmemberYear', 'FirstYear', 'TripBased', 'None');
-- Should return: 0

-- Check 2: Count benefits by new cadence
SELECT "resetCadence", COUNT(*) as count
FROM "MasterBenefit"
GROUP BY "resetCadence"
ORDER BY "resetCadence";
-- Expected:
--   ANNUAL:      48
--   CUSTOM:      17
--   MONTHLY:      0
--   QUARTERLY:    0
--   SEMI_ANNUAL:  0
--   Total:       65

-- Check 3: List all CUSTOM benefits (for manual review)
SELECT mc."cardName", mb."name", mb."stickerValue", mb."resetCadence"
FROM "MasterBenefit" mb
JOIN "MasterCard" mc ON mb."masterCardId" = mc."id"
WHERE mb."resetCadence" = 'CUSTOM'
ORDER BY mc."cardName", mb."name";
