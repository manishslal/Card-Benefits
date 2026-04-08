-- Fix CRITICAL-1: Unique constraint blocks period rollover
--
-- The old constraint @@unique([userCardId, name]) prevents creating multiple
-- period rows for the same benefit (e.g., April + May rows for "$10 Dining Credit").
-- The new constraint includes periodStart so each period can have its own row.
--
-- NOTE: PostgreSQL treats each NULL as distinct in unique constraints, so
-- legacy rows with periodStart=NULL will not conflict with each other.

-- Drop the old unique constraint
DROP INDEX IF EXISTS "UserBenefit_userCardId_name_key";

-- Create the new unique constraint that allows multiple periods per benefit
CREATE UNIQUE INDEX "UserBenefit_userCardId_name_periodStart_key"
  ON "UserBenefit"("userCardId", "name", "periodStart");
