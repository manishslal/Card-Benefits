-- Ensure variableAmounts column exists on MasterBenefit
ALTER TABLE "MasterBenefit" ADD COLUMN IF NOT EXISTS "variableAmounts" JSONB;

-- Fix Resy Credit cadence from FLEXIBLE_ANNUAL to SEMI_ANNUAL
UPDATE "MasterBenefit"
SET "claimingCadence" = 'SEMI_ANNUAL'
WHERE "name" LIKE 'Resy Credit%'
  AND "claimingCadence" = 'FLEXIBLE_ANNUAL';
