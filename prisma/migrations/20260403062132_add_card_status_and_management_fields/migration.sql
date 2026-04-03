/*
  Warnings:

  - You are about to drop the column `valueHistory` on the `UserBenefit` table. All the data in the column will be lost.
  - You are about to drop the column `valueUpdatedAt` on the `UserBenefit` table. All the data in the column will be lost.
  - You are about to drop the column `valueUpdatedBy` on the `UserBenefit` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_UserBenefit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userCardId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "stickerValue" INTEGER NOT NULL,
    "resetCadence" TEXT NOT NULL,
    "userDeclaredValue" INTEGER,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "timesUsed" INTEGER NOT NULL DEFAULT 0,
    "expirationDate" DATETIME,
    "importedFrom" TEXT,
    "importedAt" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "claimedAt" DATETIME,
    CONSTRAINT "UserBenefit_userCardId_fkey" FOREIGN KEY ("userCardId") REFERENCES "UserCard" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserBenefit_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_UserBenefit" ("claimedAt", "createdAt", "expirationDate", "id", "importedAt", "importedFrom", "isUsed", "name", "playerId", "resetCadence", "stickerValue", "timesUsed", "type", "updatedAt", "userCardId", "userDeclaredValue", "version") SELECT "claimedAt", "createdAt", "expirationDate", "id", "importedAt", "importedFrom", "isUsed", "name", "playerId", "resetCadence", "stickerValue", "timesUsed", "type", "updatedAt", "userCardId", "userDeclaredValue", "version" FROM "UserBenefit";
DROP TABLE "UserBenefit";
ALTER TABLE "new_UserBenefit" RENAME TO "UserBenefit";
CREATE INDEX "UserBenefit_userCardId_idx" ON "UserBenefit"("userCardId");
CREATE INDEX "UserBenefit_playerId_idx" ON "UserBenefit"("playerId");
CREATE INDEX "UserBenefit_userCardId_name_idx" ON "UserBenefit"("userCardId", "name");
CREATE INDEX "UserBenefit_type_idx" ON "UserBenefit"("type");
CREATE INDEX "UserBenefit_isUsed_idx" ON "UserBenefit"("isUsed");
CREATE INDEX "UserBenefit_expirationDate_idx" ON "UserBenefit"("expirationDate");
CREATE UNIQUE INDEX "UserBenefit_userCardId_name_key" ON "UserBenefit"("userCardId", "name");
CREATE TABLE "new_UserCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playerId" TEXT NOT NULL,
    "masterCardId" TEXT NOT NULL,
    "customName" TEXT,
    "actualAnnualFee" INTEGER,
    "renewalDate" DATETIME NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "statusChangedAt" DATETIME,
    "statusChangedReason" TEXT,
    "statusChangedBy" TEXT,
    "archivedAt" DATETIME,
    "archivedBy" TEXT,
    "archivedReason" TEXT,
    "importedFrom" TEXT,
    "importedAt" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserCard_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserCard_masterCardId_fkey" FOREIGN KEY ("masterCardId") REFERENCES "MasterCard" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_UserCard" ("actualAnnualFee", "createdAt", "customName", "id", "importedAt", "importedFrom", "isOpen", "masterCardId", "playerId", "renewalDate", "updatedAt", "version") SELECT "actualAnnualFee", "createdAt", "customName", "id", "importedAt", "importedFrom", "isOpen", "masterCardId", "playerId", "renewalDate", "updatedAt", "version" FROM "UserCard";
DROP TABLE "UserCard";
ALTER TABLE "new_UserCard" RENAME TO "UserCard";
CREATE INDEX "UserCard_playerId_idx" ON "UserCard"("playerId");
CREATE INDEX "UserCard_masterCardId_idx" ON "UserCard"("masterCardId");
CREATE INDEX "UserCard_playerId_masterCardId_idx" ON "UserCard"("playerId", "masterCardId");
CREATE INDEX "UserCard_playerId_status_idx" ON "UserCard"("playerId", "status");
CREATE INDEX "UserCard_renewalDate_idx" ON "UserCard"("renewalDate");
CREATE INDEX "UserCard_archivedAt_idx" ON "UserCard"("archivedAt");
CREATE UNIQUE INDEX "UserCard_playerId_masterCardId_key" ON "UserCard"("playerId", "masterCardId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
