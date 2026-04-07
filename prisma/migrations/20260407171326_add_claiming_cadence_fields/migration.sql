-- ============================================================================
-- Phase 6C: Add Claiming Cadence Fields to MasterBenefit
-- ============================================================================
-- This migration adds support for benefit claiming cadence tracking.
-- 
-- New Fields:
-- - claimingCadence: Enum-like string (MONTHLY, QUARTERLY, SEMI_ANNUAL, FLEXIBLE_ANNUAL, ONE_TIME)
-- - claimingAmount: Amount per period in cents (e.g., 1500 = $15.00)
-- - claimingWindowEnd: Optional custom window end date (e.g., "0918" for Amex Sept 18)
--
-- SAFETY NOTES:
-- ✅ All new columns are nullable - existing benefits unaffected
-- ✅ No data is deleted or modified
-- ✅ Index on claimingCadence for query optimization
-- ✅ Fully reversible via rollback
-- ============================================================================

-- Add claiming cadence columns to MasterBenefit
ALTER TABLE "MasterBenefit"
ADD COLUMN "claimingCadence" VARCHAR(50),
ADD COLUMN "claimingAmount" INTEGER,
ADD COLUMN "claimingWindowEnd" VARCHAR(10);

-- Create index on claimingCadence for query optimization
CREATE INDEX "idx_masterbenefit_claimingcadence" ON "MasterBenefit"("claimingCadence");

-- ============================================================================
-- Rollback Instructions (for reference)
-- ============================================================================
-- DROP INDEX IF EXISTS "idx_masterbenefit_claimingcadence";
-- ALTER TABLE "MasterBenefit" DROP COLUMN "claimingWindowEnd";
-- ALTER TABLE "MasterBenefit" DROP COLUMN "claimingAmount";
-- ALTER TABLE "MasterBenefit" DROP COLUMN "claimingCadence";
-- ============================================================================
