-- ============================================================================
-- Benefit Engine Schema Migration (Phase 1)
-- ============================================================================
-- This migration adds the benefit engine fields to UserBenefit and links
-- UserBenefit to MasterBenefit via a foreign key. It also adds period
-- tracking fields and performance indexes.
--
-- New Fields on UserBenefit:
-- - masterBenefitId: FK to MasterBenefit (nullable — custom benefits won't have one)
-- - periodStart: Start of this benefit period (nullable for legacy rows)
-- - periodEnd: End of this benefit period (nullable for ONE_TIME or legacy rows)
-- - periodStatus: ACTIVE | EXPIRED | UPCOMING (default: ACTIVE)
--
-- SAFETY NOTES:
-- ✅ All new columns are nullable or have defaults — existing data unaffected
-- ✅ No existing columns removed or renamed — fully backward compatible
-- ✅ FK uses ON DELETE SET NULL — deleting a MasterBenefit won't cascade-delete UserBenefits
-- ✅ Existing @@unique([userCardId, name]) is preserved
-- ✅ Fully reversible via rollback SQL below
-- ============================================================================

-- Step 1: Add new columns to UserBenefit
ALTER TABLE "UserBenefit" ADD COLUMN "masterBenefitId" TEXT;
ALTER TABLE "UserBenefit" ADD COLUMN "periodStart" TIMESTAMP(3);
ALTER TABLE "UserBenefit" ADD COLUMN "periodEnd" TIMESTAMP(3);
ALTER TABLE "UserBenefit" ADD COLUMN "periodStatus" TEXT NOT NULL DEFAULT 'ACTIVE';

-- Step 2: Add foreign key constraint
ALTER TABLE "UserBenefit"
  ADD CONSTRAINT "UserBenefit_masterBenefitId_fkey"
  FOREIGN KEY ("masterBenefitId")
  REFERENCES "MasterBenefit"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 3: Add performance indexes
-- Index for FK joins on masterBenefitId
CREATE INDEX "UserBenefit_masterBenefitId_idx" ON "UserBenefit"("masterBenefitId");

-- Index for filtering by periodStatus (dashboard queries)
CREATE INDEX "UserBenefit_periodStatus_idx" ON "UserBenefit"("periodStatus");

-- Compound index for cron job: find ACTIVE benefits past their periodEnd
CREATE INDEX "UserBenefit_periodEnd_periodStatus_idx" ON "UserBenefit"("periodEnd", "periodStatus");

-- Compound index for uniqueness checks during benefit generation
CREATE INDEX "UserBenefit_userCardId_masterBenefitId_periodStart_idx" ON "UserBenefit"("userCardId", "masterBenefitId", "periodStart");

-- ============================================================================
-- Rollback Instructions (for reference)
-- ============================================================================
-- DROP INDEX IF EXISTS "UserBenefit_userCardId_masterBenefitId_periodStart_idx";
-- DROP INDEX IF EXISTS "UserBenefit_periodEnd_periodStatus_idx";
-- DROP INDEX IF EXISTS "UserBenefit_periodStatus_idx";
-- DROP INDEX IF EXISTS "UserBenefit_masterBenefitId_idx";
-- ALTER TABLE "UserBenefit" DROP CONSTRAINT IF EXISTS "UserBenefit_masterBenefitId_fkey";
-- ALTER TABLE "UserBenefit" DROP COLUMN IF EXISTS "periodStatus";
-- ALTER TABLE "UserBenefit" DROP COLUMN IF EXISTS "periodEnd";
-- ALTER TABLE "UserBenefit" DROP COLUMN IF EXISTS "periodStart";
-- ALTER TABLE "UserBenefit" DROP COLUMN IF EXISTS "masterBenefitId";
-- ============================================================================