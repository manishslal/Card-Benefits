-- Create enums
CREATE TYPE "BenefitEventFamily" AS ENUM ('UNLIMITED_USE', 'MULTIPLIER_SPEND');
CREATE TYPE "BenefitEventType" AS ENUM ('USAGE_ADD', 'USAGE_REMOVE', 'SPEND_ADD', 'SPEND_REMOVE', 'POINTS_ADD', 'POINTS_REMOVE', 'ADJUSTMENT');

-- Create event ledger table
CREATE TABLE "BenefitEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userCardId" TEXT NOT NULL,
    "userBenefitId" TEXT NOT NULL,
    "eventFamily" "BenefitEventFamily" NOT NULL,
    "eventType" "BenefitEventType" NOT NULL,
    "amountCents" INTEGER,
    "points" INTEGER,
    "quantity" INTEGER,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "endpointScope" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "source" TEXT,
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BenefitEvent_pkey" PRIMARY KEY ("id")
);

-- Create projection table
CREATE TABLE "BenefitTrackerProjection" (
    "userBenefitId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "unlimitedNetCount" INTEGER NOT NULL DEFAULT 0,
    "spendCentsTotal" INTEGER NOT NULL DEFAULT 0,
    "pointsTotal" INTEGER NOT NULL DEFAULT 0,
    "lastEventAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BenefitTrackerProjection_pkey" PRIMARY KEY ("userBenefitId")
);

-- Indexes
CREATE INDEX "BenefitEvent_userBenefitId_eventDate_idx" ON "BenefitEvent"("userBenefitId", "eventDate" DESC);
CREATE INDEX "BenefitEvent_userId_eventDate_idx" ON "BenefitEvent"("userId", "eventDate" DESC);
CREATE INDEX "BenefitEvent_eventFamily_eventType_eventDate_idx" ON "BenefitEvent"("eventFamily", "eventType", "eventDate");
CREATE UNIQUE INDEX "uniq_event_idempotency_scope" ON "BenefitEvent"("userId", "endpointScope", "idempotencyKey");
CREATE INDEX "BenefitTrackerProjection_periodStart_periodEnd_idx" ON "BenefitTrackerProjection"("periodStart", "periodEnd");

-- Foreign keys
ALTER TABLE "BenefitEvent"
    ADD CONSTRAINT "BenefitEvent_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BenefitEvent"
    ADD CONSTRAINT "BenefitEvent_userCardId_fkey"
    FOREIGN KEY ("userCardId") REFERENCES "UserCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BenefitEvent"
    ADD CONSTRAINT "BenefitEvent_userBenefitId_fkey"
    FOREIGN KEY ("userBenefitId") REFERENCES "UserBenefit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BenefitTrackerProjection"
    ADD CONSTRAINT "BenefitTrackerProjection_userBenefitId_fkey"
    FOREIGN KEY ("userBenefitId") REFERENCES "UserBenefit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
