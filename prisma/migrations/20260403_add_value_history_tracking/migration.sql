-- Add value history tracking columns to UserBenefit table
-- These columns support the Custom Values feature for value override auditing

-- Add valueHistory column to store JSON array of historical value changes
ALTER TABLE "UserBenefit" ADD COLUMN "valueHistory" TEXT;

-- Add valueUpdatedAt to track when userDeclaredValue was last modified
ALTER TABLE "UserBenefit" ADD COLUMN "valueUpdatedAt" DATETIME;

-- Add valueUpdatedBy to track which user (or system) made the last change
ALTER TABLE "UserBenefit" ADD COLUMN "valueUpdatedBy" STRING;

-- Create index on valueUpdatedAt for efficient historical queries
CREATE INDEX "UserBenefit_valueUpdatedAt" ON "UserBenefit"("valueUpdatedAt");

-- Create compound index on playerId and valueUpdatedAt for user-scoped history queries
CREATE INDEX "UserBenefit_playerId_valueUpdatedAt" ON "UserBenefit"("playerId", "valueUpdatedAt");
