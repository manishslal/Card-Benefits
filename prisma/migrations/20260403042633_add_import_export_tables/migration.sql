-- CreateTable
CREATE TABLE "MasterCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "issuer" TEXT NOT NULL,
    "cardName" TEXT NOT NULL,
    "defaultAnnualFee" INTEGER NOT NULL,
    "cardImageUrl" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MasterBenefit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "masterCardId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "stickerValue" INTEGER NOT NULL,
    "resetCadence" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MasterBenefit_masterCardId_fkey" FOREIGN KEY ("masterCardId") REFERENCES "MasterCard" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "isValid" BOOLEAN NOT NULL DEFAULT true,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "playerName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Player_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playerId" TEXT NOT NULL,
    "masterCardId" TEXT NOT NULL,
    "customName" TEXT,
    "actualAnnualFee" INTEGER,
    "renewalDate" DATETIME NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "importedFrom" TEXT,
    "importedAt" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserCard_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserCard_masterCardId_fkey" FOREIGN KEY ("masterCardId") REFERENCES "MasterCard" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserBenefit" (
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

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileFormat" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileHash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Uploaded',
    "totalRecords" INTEGER NOT NULL,
    "processedRecords" INTEGER NOT NULL DEFAULT 0,
    "skippedRecords" INTEGER NOT NULL DEFAULT 0,
    "failedRecords" INTEGER NOT NULL DEFAULT 0,
    "warningRecords" INTEGER NOT NULL DEFAULT 0,
    "importType" TEXT NOT NULL,
    "cardsCreated" INTEGER NOT NULL DEFAULT 0,
    "cardsUpdated" INTEGER NOT NULL DEFAULT 0,
    "benefitsCreated" INTEGER NOT NULL DEFAULT 0,
    "benefitsUpdated" INTEGER NOT NULL DEFAULT 0,
    "errorLog" TEXT,
    "previewData" TEXT,
    "conflictLog" TEXT,
    "columnMappings" TEXT,
    "detectionConfidence" REAL DEFAULT 1.0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedAt" DATETIME,
    "parsedAt" DATETIME,
    "validatedAt" DATETIME,
    "committedAt" DATETIME,
    "completedAt" DATETIME,
    CONSTRAINT "ImportJob_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ImportJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImportRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importJobId" TEXT NOT NULL,
    "recordType" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "sequenceIndex" INTEGER NOT NULL,
    "data" TEXT NOT NULL,
    "normalizedData" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Valid',
    "validationErrors" TEXT,
    "validationWarnings" TEXT,
    "isDuplicate" BOOLEAN NOT NULL DEFAULT false,
    "duplicateOf" TEXT,
    "userResolution" TEXT,
    "createdCardId" TEXT,
    "createdBenefitId" TEXT,
    "updatedCardId" TEXT,
    "updatedBenefitId" TEXT,
    "appliedData" TEXT,
    "processedAt" DATETIME,
    "appliedAt" DATETIME,
    CONSTRAINT "ImportRecord_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserImportProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "fileFormat" TEXT NOT NULL,
    "columnMappings" TEXT NOT NULL,
    "mappingConfidence" REAL NOT NULL DEFAULT 1.0,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserImportProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "MasterCard_issuer_idx" ON "MasterCard"("issuer");

-- CreateIndex
CREATE INDEX "MasterCard_cardName_idx" ON "MasterCard"("cardName");

-- CreateIndex
CREATE UNIQUE INDEX "MasterCard_issuer_cardName_key" ON "MasterCard"("issuer", "cardName");

-- CreateIndex
CREATE INDEX "MasterBenefit_masterCardId_idx" ON "MasterBenefit"("masterCardId");

-- CreateIndex
CREATE INDEX "MasterBenefit_type_idx" ON "MasterBenefit"("type");

-- CreateIndex
CREATE INDEX "MasterBenefit_resetCadence_idx" ON "MasterBenefit"("resetCadence");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "Player_userId_idx" ON "Player"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Player_userId_playerName_key" ON "Player"("userId", "playerName");

-- CreateIndex
CREATE INDEX "UserCard_playerId_idx" ON "UserCard"("playerId");

-- CreateIndex
CREATE INDEX "UserCard_masterCardId_idx" ON "UserCard"("masterCardId");

-- CreateIndex
CREATE INDEX "UserCard_playerId_masterCardId_idx" ON "UserCard"("playerId", "masterCardId");

-- CreateIndex
CREATE UNIQUE INDEX "UserCard_playerId_masterCardId_key" ON "UserCard"("playerId", "masterCardId");

-- CreateIndex
CREATE INDEX "UserBenefit_userCardId_idx" ON "UserBenefit"("userCardId");

-- CreateIndex
CREATE INDEX "UserBenefit_playerId_idx" ON "UserBenefit"("playerId");

-- CreateIndex
CREATE INDEX "UserBenefit_userCardId_name_idx" ON "UserBenefit"("userCardId", "name");

-- CreateIndex
CREATE INDEX "UserBenefit_type_idx" ON "UserBenefit"("type");

-- CreateIndex
CREATE INDEX "UserBenefit_isUsed_idx" ON "UserBenefit"("isUsed");

-- CreateIndex
CREATE INDEX "UserBenefit_expirationDate_idx" ON "UserBenefit"("expirationDate");

-- CreateIndex
CREATE UNIQUE INDEX "UserBenefit_userCardId_name_key" ON "UserBenefit"("userCardId", "name");

-- CreateIndex
CREATE INDEX "ImportJob_playerId_idx" ON "ImportJob"("playerId");

-- CreateIndex
CREATE INDEX "ImportJob_userId_idx" ON "ImportJob"("userId");

-- CreateIndex
CREATE INDEX "ImportJob_status_idx" ON "ImportJob"("status");

-- CreateIndex
CREATE INDEX "ImportJob_createdAt_idx" ON "ImportJob"("createdAt");

-- CreateIndex
CREATE INDEX "ImportJob_playerId_createdAt_idx" ON "ImportJob"("playerId", "createdAt");

-- CreateIndex
CREATE INDEX "ImportRecord_importJobId_idx" ON "ImportRecord"("importJobId");

-- CreateIndex
CREATE INDEX "ImportRecord_status_idx" ON "ImportRecord"("status");

-- CreateIndex
CREATE INDEX "ImportRecord_rowNumber_idx" ON "ImportRecord"("rowNumber");

-- CreateIndex
CREATE INDEX "ImportRecord_isDuplicate_idx" ON "ImportRecord"("isDuplicate");

-- CreateIndex
CREATE INDEX "UserImportProfile_userId_idx" ON "UserImportProfile"("userId");

-- CreateIndex
CREATE INDEX "UserImportProfile_lastUsedAt_idx" ON "UserImportProfile"("lastUsedAt");
