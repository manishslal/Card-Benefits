-- Sprint 1: Benefit Engine Remediation
-- cat-4: Add variableAmounts JSON field to MasterBenefit for per-period overrides
-- (e.g., Amex Uber December $35 instead of default $15)
ALTER TABLE "MasterBenefit" ADD COLUMN "variableAmounts" JSONB;

-- cat-5: Fix Resy credit claimingCadence from FLEXIBLE_ANNUAL to SEMI_ANNUAL
UPDATE "MasterBenefit"
SET "claimingCadence" = 'SEMI_ANNUAL'
WHERE "name" LIKE 'Resy Credit%'
  AND "claimingCadence" = 'FLEXIBLE_ANNUAL';

-- cat-4: Set variableAmounts for Amex Platinum $200 Uber Cash
UPDATE "MasterBenefit"
SET "variableAmounts" = '{"12": 3500}'::jsonb
WHERE "name" = '$200 Uber Cash'
  AND "claimingCadence" = 'MONTHLY'
  AND "claimingAmount" = 1500;
