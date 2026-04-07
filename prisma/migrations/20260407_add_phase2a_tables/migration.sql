-- ============================================================================
-- Phase 2A-3: Safe Migration - Benefit Usage Tracking, Periods, Recommendations
-- ============================================================================
-- This migration adds three new tables for enhanced benefit tracking:
-- 1. BenefitUsageRecord - Track individual benefit usage events
-- 2. BenefitPeriod - Track benefit periods and calculate progress
-- 3. BenefitRecommendation - Store personalized benefit recommendations
--
-- SAFETY NOTES:
-- ✅ NO data is deleted or modified
-- ✅ NO existing tables are dropped
-- ✅ NO existing columns are dropped
-- ✅ All new tables have proper foreign keys with CASCADE delete
-- ✅ All relationships point to existing tables
-- ============================================================================

-- CreateTable: BenefitUsageRecord
-- Track individual benefit usage events
-- Relationships: User (cascade), UserBenefit (cascade), BenefitPeriod (optional)
CREATE TABLE "BenefitUsageRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "benefitId" TEXT NOT NULL,
    "benefitPeriodId" TEXT,
    "usageAmount" DECIMAL(10,2) NOT NULL,
    "usageDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BenefitUsageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: BenefitUsageRecord - Performance indexes
CREATE INDEX "BenefitUsageRecord_userId_idx" ON "BenefitUsageRecord"("userId");
CREATE INDEX "BenefitUsageRecord_benefitId_idx" ON "BenefitUsageRecord"("benefitId");
CREATE INDEX "BenefitUsageRecord_usageDate_idx" ON "BenefitUsageRecord"("usageDate");
CREATE INDEX "BenefitUsageRecord_userId_benefitId_idx" ON "BenefitUsageRecord"("userId", "benefitId");

-- CreateTable: BenefitPeriod
-- Track individual benefit periods and calculate progress
-- Relationships: UserBenefit (cascade), User (cascade)
CREATE TABLE "BenefitPeriod" (
    "id" TEXT NOT NULL,
    "benefitId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "periodType" TEXT NOT NULL,
    "resetCadence" TEXT NOT NULL,
    "totalUsed" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "usageStatus" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BenefitPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: BenefitPeriod - Performance indexes
CREATE INDEX "BenefitPeriod_userId_idx" ON "BenefitPeriod"("userId");
CREATE INDEX "BenefitPeriod_benefitId_idx" ON "BenefitPeriod"("benefitId");
CREATE INDEX "BenefitPeriod_periodStart_idx" ON "BenefitPeriod"("periodStart");
CREATE INDEX "BenefitPeriod_periodEnd_idx" ON "BenefitPeriod"("periodEnd");
CREATE UNIQUE INDEX "BenefitPeriod_benefitId_userId_periodStart_periodEnd_key" ON "BenefitPeriod"("benefitId", "userId", "periodStart", "periodEnd");

-- CreateTable: BenefitRecommendation
-- Store personalized benefit recommendations
-- Relationships: User (cascade), UserBenefit (cascade)
CREATE TABLE "BenefitRecommendation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "benefitId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "matchedCriteria" TEXT,
    "dismissedAt" TIMESTAMP(3),
    "dismissReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BenefitRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: BenefitRecommendation - Performance indexes
CREATE INDEX "BenefitRecommendation_userId_idx" ON "BenefitRecommendation"("userId");
CREATE INDEX "BenefitRecommendation_benefitId_idx" ON "BenefitRecommendation"("benefitId");
CREATE INDEX "BenefitRecommendation_score_idx" ON "BenefitRecommendation"("score");
CREATE INDEX "BenefitRecommendation_userId_dismissedAt_idx" ON "BenefitRecommendation"("userId", "dismissedAt");

-- AddForeignKey: BenefitUsageRecord -> User (CASCADE)
ALTER TABLE "BenefitUsageRecord" ADD CONSTRAINT "BenefitUsageRecord_userId_fkey" 
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: BenefitUsageRecord -> UserBenefit (CASCADE)
ALTER TABLE "BenefitUsageRecord" ADD CONSTRAINT "BenefitUsageRecord_benefitId_fkey" 
  FOREIGN KEY ("benefitId") REFERENCES "UserBenefit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: BenefitUsageRecord -> BenefitPeriod (CASCADE on delete, but optional)
ALTER TABLE "BenefitUsageRecord" ADD CONSTRAINT "BenefitUsageRecord_benefitPeriodId_fkey" 
  FOREIGN KEY ("benefitPeriodId") REFERENCES "BenefitPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: BenefitPeriod -> UserBenefit (CASCADE)
ALTER TABLE "BenefitPeriod" ADD CONSTRAINT "BenefitPeriod_benefitId_fkey" 
  FOREIGN KEY ("benefitId") REFERENCES "UserBenefit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: BenefitPeriod -> User (CASCADE)
ALTER TABLE "BenefitPeriod" ADD CONSTRAINT "BenefitPeriod_userId_fkey" 
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: BenefitRecommendation -> User (CASCADE)
ALTER TABLE "BenefitRecommendation" ADD CONSTRAINT "BenefitRecommendation_userId_fkey" 
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: BenefitRecommendation -> UserBenefit (CASCADE)
ALTER TABLE "BenefitRecommendation" ADD CONSTRAINT "BenefitRecommendation_benefitId_fkey" 
  FOREIGN KEY ("benefitId") REFERENCES "UserBenefit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
