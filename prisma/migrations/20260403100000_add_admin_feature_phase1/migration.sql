-- CreateEnum: UserRole
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum: AuditActionType
CREATE TYPE "AuditActionType" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

-- CreateEnum: ResourceType
CREATE TYPE "ResourceType" AS ENUM ('CARD', 'BENEFIT', 'USER_ROLE', 'SYSTEM_SETTING');

-- AlterTable: User
-- Add role field with default value USER
ALTER TABLE "User" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'USER';
ALTER TABLE "User" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex: User.role
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex: User.isActive
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

-- AlterTable: MasterCard
-- Add display and archive properties
ALTER TABLE "MasterCard" ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "MasterCard" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "MasterCard" ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MasterCard" ADD COLUMN "createdByAdminId" TEXT;
ALTER TABLE "MasterCard" ADD COLUMN "archivedByAdminId" TEXT;
ALTER TABLE "MasterCard" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "MasterCard" ADD COLUMN "archivedReason" TEXT;

-- CreateIndex: MasterCard.displayOrder
CREATE INDEX "MasterCard_displayOrder_idx" ON "MasterCard"("displayOrder");

-- CreateIndex: MasterCard.isActive
CREATE INDEX "MasterCard_isActive_idx" ON "MasterCard"("isActive");

-- CreateIndex: MasterCard.isArchived
CREATE INDEX "MasterCard_isArchived_idx" ON "MasterCard"("isArchived");

-- AlterTable: MasterBenefit
-- Add default and isActive properties
ALTER TABLE "MasterBenefit" ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "MasterBenefit" ADD COLUMN "createdByAdminId" TEXT;

-- CreateIndex: MasterBenefit.isDefault
CREATE INDEX "MasterBenefit_isDefault_idx" ON "MasterBenefit"("isDefault");

-- CreateIndex: MasterBenefit.isActive
CREATE INDEX "MasterBenefit_isActive_idx" ON "MasterBenefit"("isActive");

-- CreateTable: AdminAuditLog
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "actionType" "AuditActionType" NOT NULL,
    "resourceType" "ResourceType" NOT NULL,
    "resourceId" TEXT NOT NULL,
    "resourceName" TEXT,
    "oldValues" TEXT,
    "newValues" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: AdminAuditLog
CREATE INDEX "AdminAuditLog_adminUserId_idx" ON "AdminAuditLog"("adminUserId");
CREATE INDEX "AdminAuditLog_actionType_idx" ON "AdminAuditLog"("actionType");
CREATE INDEX "AdminAuditLog_resourceType_idx" ON "AdminAuditLog"("resourceType");
CREATE INDEX "AdminAuditLog_resourceId_idx" ON "AdminAuditLog"("resourceId");
CREATE INDEX "AdminAuditLog_timestamp_idx" ON "AdminAuditLog"("timestamp");
CREATE INDEX "AdminAuditLog_adminUserId_timestamp_idx" ON "AdminAuditLog"("adminUserId", "timestamp");

-- AddForeignKey: AdminAuditLog
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
