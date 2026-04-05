import { PrismaClient } from '@prisma/client';

// Singleton pattern to avoid multiple Prisma client instances
// CRITICAL: Must cache in BOTH development AND production
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query'] : [],
  });

// Cache the Prisma instance in global scope for both dev and production
// This prevents creating a new connection pool on every request
// In production, this is critical to avoid exhausting database connections
if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = prisma;
}

// Common database operations
export const db = {
  // Master Catalog operations
  async getMasterCard(id: string) {
    return prisma.masterCard.findUnique({
      where: { id },
      include: { masterBenefits: true },
    });
  },

  async searchMasterCards(issuer?: string, cardName?: string) {
    return prisma.masterCard.findMany({
      where: {
        // `mode: 'insensitive'` is intentionally omitted — SQLite's LIKE operator is
        // ASCII-case-insensitive by default, so search behaviour is preserved without it.
        // If migrating back to PostgreSQL, re-add `mode: 'insensitive'` to both filters
        // below; PostgreSQL's LIKE is case-sensitive by default and requires this option.
        // See .github/specs/sqlite-compat-spec.md for full context.
        ...(issuer && { issuer: { contains: issuer } }),
        ...(cardName && { cardName: { contains: cardName } }),
      },
      include: { masterBenefits: true },
    });
  },

  // User wallet operations
  async getUserWallet(playerId: string) {
    return prisma.userCard.findMany({
      where: { playerId },
      include: {
        masterCard: { include: { masterBenefits: true } },
        userBenefits: true,
      },
    });
  },

  async addCardToWallet(
    playerId: string,
    masterCardId: string,
    customName?: string,
    renewalDate?: Date
  ) {
    return prisma.userCard.create({
      data: {
        playerId,
        masterCardId,
        customName,
        renewalDate: renewalDate || new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
      },
      include: { userBenefits: true },
    });
  },

  // Benefit tracking operations
  async claimBenefit(userBenefitId: string) {
    return prisma.userBenefit.update({
      where: { id: userBenefitId },
      data: {
        isUsed: true,
        claimedAt: new Date(),
        timesUsed: { increment: 1 },
      },
    });
  },

  async getUnclaimedBenefits(playerId: string) {
    return prisma.userBenefit.findMany({
      where: {
        playerId,
        isUsed: false,
        expirationDate: { gt: new Date() },
      },
      include: { userCard: { include: { masterCard: true } } },
    });
  },

  async calculatePlayerValue(playerId: string) {
    const benefits = await prisma.userBenefit.findMany({
      where: { playerId },
    });

    const totalValue = benefits.reduce((sum, b) => sum + (b.userDeclaredValue || b.stickerValue), 0);
    const unclaimedValue = benefits
      .filter((b) => !b.isUsed && (!b.expirationDate || b.expirationDate > new Date()))
      .reduce((sum, b) => sum + (b.userDeclaredValue || b.stickerValue), 0);

    return { totalValue, unclaimedValue };
  },

  // Player operations
  async createPlayer(userId: string, playerName: string) {
    return prisma.player.create({
      data: { userId, playerName },
    });
  },

  async getPlayerProfiles(userId: string) {
    return prisma.player.findMany({
      where: { userId, isActive: true },
      include: {
        userCards: { include: { masterCard: true } },
        userBenefits: true,
      },
    });
  },
};

export default prisma;
