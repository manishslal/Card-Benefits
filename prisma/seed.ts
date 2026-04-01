const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Helper: calculate expirationDate inline to avoid import issues with ts-node
function calcExpirationDate(resetCadence: string, renewalDate: Date, now: Date = new Date()): Date | null {
  switch (resetCadence) {
    case 'Monthly': {
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      lastDay.setHours(23, 59, 59, 999);
      return lastDay;
    }
    case 'CalendarYear': {
      const dec31 = new Date(now.getFullYear(), 11, 31);
      dec31.setHours(23, 59, 59, 999);
      return dec31;
    }
    case 'CardmemberYear': {
      const dayBefore = new Date(renewalDate);
      dayBefore.setDate(dayBefore.getDate() - 1);
      dayBefore.setHours(23, 59, 59, 999);
      return dayBefore;
    }
    case 'OneTime':
    default:
      return null;
  }
}

// Types
type BenefitSeed = {
  name: string;
  type: 'StatementCredit' | 'UsagePerk';
  stickerValue: number;
  resetCadence: 'Monthly' | 'CalendarYear' | 'CardmemberYear' | 'OneTime';
};

type CardSeed = {
  issuer: string;
  cardName: string;
  defaultAnnualFee: number;
  cardImageUrl: string;
  benefits: BenefitSeed[];
};

// Master Catalog seed data
const MASTER_CARDS: CardSeed[] = [
  // ── American Express Gold ──────────────────────────────────────────────────
  {
    issuer: 'American Express',
    cardName: 'American Express Gold Card',
    defaultAnnualFee: 25000, // $250
    cardImageUrl:
      'https://icm.aexp-static.com/Internet/Acquisition/US_en/AppContent/OneSite/category/cardarts/gold-card.png',
    benefits: [
      {
        name: '$10 Monthly Uber Cash',
        type: 'StatementCredit',
        stickerValue: 1000, // $10/mo → $120/yr
        resetCadence: 'Monthly',
      },
      {
        name: '$10 Monthly Dining Credit',
        type: 'StatementCredit',
        stickerValue: 1000, // $10/mo → $120/yr
        resetCadence: 'Monthly',
      },
      {
        name: "Dunkin' Credit",
        type: 'StatementCredit',
        stickerValue: 700, // $7/mo → $84/yr
        resetCadence: 'Monthly',
      },
      // Resy $100/yr split into two half-year CalendarYear windows (no SemiAnnual cadence)
      {
        name: 'Resy Credit (Jan–Jun)',
        type: 'StatementCredit',
        stickerValue: 5000, // $50
        resetCadence: 'CalendarYear',
      },
      {
        name: 'Resy Credit (Jul–Dec)',
        type: 'StatementCredit',
        stickerValue: 5000, // $50
        resetCadence: 'CalendarYear',
      },
    ],
  },

  // ── American Express Platinum ──────────────────────────────────────────────
  {
    issuer: 'American Express',
    cardName: 'American Express Platinum Card',
    defaultAnnualFee: 69500, // $695
    cardImageUrl:
      'https://icm.aexp-static.com/Internet/Acquisition/US_en/AppContent/OneSite/category/cardarts/platinum-card.png',
    benefits: [
      {
        name: '$200 Airline Fee Credit',
        type: 'StatementCredit',
        stickerValue: 20000, // $200/yr
        resetCadence: 'CalendarYear',
      },
      // $15×11 + $35 in Dec = $200/yr — modelled as a single CalendarYear benefit
      {
        name: '$200 Uber Cash',
        type: 'StatementCredit',
        stickerValue: 20000, // $200/yr
        resetCadence: 'CalendarYear',
      },
      // Saks $100/yr split into two half-year CalendarYear windows
      {
        name: '$50 Saks Credit (Jan–Jun)',
        type: 'StatementCredit',
        stickerValue: 5000, // $50
        resetCadence: 'CalendarYear',
      },
      {
        name: '$50 Saks Credit (Jul–Dec)',
        type: 'StatementCredit',
        stickerValue: 5000, // $50
        resetCadence: 'CalendarYear',
      },
      {
        name: '$240 Digital Entertainment Credit',
        type: 'StatementCredit',
        stickerValue: 2000, // $20/mo → $240/yr
        resetCadence: 'Monthly',
      },
      // Continuous access perk — no monetary reset schedule
      {
        name: 'Global Lounge Collection Access',
        type: 'UsagePerk',
        stickerValue: 0,
        resetCadence: 'OneTime',
      },
    ],
  },
];

// Main seed function
async function main(): Promise<void> {
  console.log('🌱 Starting seed...\n');

  // ── Step 1: Master Catalog ──────────────────────────────────────────────────
  console.log('📋 Seeding Master Catalog...');

  const masterCardIds: Record<string, string> = {};

  for (const card of MASTER_CARDS) {
    const masterCard = await prisma.masterCard.upsert({
      where: { issuer_cardName: { issuer: card.issuer, cardName: card.cardName } },
      update: { defaultAnnualFee: card.defaultAnnualFee, cardImageUrl: card.cardImageUrl },
      create: {
        issuer: card.issuer,
        cardName: card.cardName,
        defaultAnnualFee: card.defaultAnnualFee,
        cardImageUrl: card.cardImageUrl,
      },
    });

    // Delete + recreate benefits for idempotency (no stable natural key on benefits)
    await prisma.masterBenefit.deleteMany({ where: { masterCardId: masterCard.id } });
    await prisma.masterBenefit.createMany({
      data: card.benefits.map((b) => ({
        masterCardId: masterCard.id,
        name: b.name,
        type: b.type,
        stickerValue: b.stickerValue,
        resetCadence: b.resetCadence,
        isActive: true,
      })),
    });

    masterCardIds[card.cardName] = masterCard.id;
    console.log(`  ✅ ${card.cardName} (${card.benefits.length} benefits)`);
  }

  // ── Step 2: User ────────────────────────────────────────────────────────────
  console.log('\n👤 Seeding User...');

  const user = await prisma.user.upsert({
    where: { email: 'test@cardtracker.dev' },
    update: {},
    create: {
      email: 'test@cardtracker.dev',
      // Placeholder hash — replace with a real bcrypt hash before going live
      passwordHash: '$2b$10$placeholderHashForDevSeedingOnly000000000000000000000000',
      firstName: 'Test',
      lastName: 'User',
      emailVerified: true,
    },
  });

  console.log(`  ✅ User: ${user.email}`);

  // ── Step 3: Players ─────────────────────────────────────────────────────────
  console.log('\n🎮 Seeding Players...');

  const primaryPlayer = await prisma.player.upsert({
    where: { userId_playerName: { userId: user.id, playerName: 'Primary' } },
    update: {},
    create: { userId: user.id, playerName: 'Primary' },
  });

  const bethanPlayer = await prisma.player.upsert({
    where: { userId_playerName: { userId: user.id, playerName: 'Bethan' } },
    update: {},
    create: { userId: user.id, playerName: 'Bethan' },
  });

  console.log(`  ✅ Player: ${primaryPlayer.playerName} (id: ${primaryPlayer.id})`);
  console.log(`  ✅ Player: ${bethanPlayer.playerName}  (id: ${bethanPlayer.id})`);

  // ── Step 4: User Wallet ─────────────────────────────────────────────────────
  console.log('\n💳 Seeding User Wallet...');

  const platinumId = masterCardIds['American Express Platinum Card'];
  const goldId     = masterCardIds['American Express Gold Card'];

  // Renewal dates — using realistic future anniversaries for test data
  const now = new Date();
  const nextYear = now.getFullYear() + 1;

  const primaryPlatinumRenewal  = new Date(`${nextYear}-03-15`);
  const primaryGoldRenewal      = new Date(`${nextYear}-07-01`);
  const bethanPlatinumRenewal   = new Date(`${nextYear}-03-15`);

  // Helper: upsert a UserCard and replace its UserBenefits from the master template
  async function seedUserCard(
    playerId: string,
    masterCardId: string,
    renewalDate: Date,
    actualAnnualFee?: number // cents; undefined = inherit defaultAnnualFee
  ) {
    // Fetch the master card + active benefits
    const master = await prisma.masterCard.findUniqueOrThrow({
      where: { id: masterCardId },
      include: { masterBenefits: { where: { isActive: true } } },
    });

    // Upsert the UserCard
    const userCard = await prisma.userCard.upsert({
      where: { playerId_masterCardId: { playerId, masterCardId } },
      update: { renewalDate, actualAnnualFee: actualAnnualFee ?? master.defaultAnnualFee },
      create: {
        playerId,
        masterCardId,
        renewalDate,
        actualAnnualFee: actualAnnualFee ?? master.defaultAnnualFee,
      },
    });

    // Wipe and re-clone benefits so re-runs stay consistent
    // (keeps only benefits derived from the master; custom benefits are added separately)
    await prisma.userBenefit.deleteMany({
      where: { userCardId: userCard.id, resetCadence: { not: 'OneTime' } },
    });

    await prisma.userBenefit.createMany({
      data: master.masterBenefits
        .filter((mb: any) => mb.resetCadence !== 'OneTime') // OneTime perks added manually below
        .map((mb: any) => ({
          userCardId: userCard.id,
          playerId,
          name: mb.name,
          type: mb.type,
          stickerValue: mb.stickerValue,
          resetCadence: mb.resetCadence,
          expirationDate: calcExpirationDate(mb.resetCadence, renewalDate, now),
        })),
    });

    return userCard;
  }

  // Card 1 — Primary → Amex Platinum (standard fee)
  const primaryPlatinum = await seedUserCard(
    primaryPlayer.id,
    platinumId,
    primaryPlatinumRenewal
  );
  console.log(`  ✅ Primary → Amex Platinum  (fee: $695, renewal: ${primaryPlatinumRenewal.toDateString()})`);

  // Card 2 — Primary → Amex Gold (retention offer: fee overridden to $325)
  await seedUserCard(
    primaryPlayer.id,
    goldId,
    primaryGoldRenewal,
    32500 // $325 — simulates a retention/NLL offer override
  );
  console.log(`  ✅ Primary → Amex Gold      (fee: $325 override, renewal: ${primaryGoldRenewal.toDateString()})`);

  // Card 3 — Bethan → Amex Platinum companion card (standard fee)
  await seedUserCard(
    bethanPlayer.id,
    platinumId,
    bethanPlatinumRenewal
  );
  console.log(`  ✅ Bethan  → Amex Platinum  (fee: $695, renewal: ${bethanPlatinumRenewal.toDateString()})`);

  // ── Step 5: Custom sign-up bonus on Primary's Amex Platinum ─────────────────
  console.log('\n🎁 Adding custom sign-up bonus benefit...');

  // Expiration: 90 days from January 24, 2026 = April 24, 2026
  const signUpBonusExpiration = new Date('2026-04-24T23:59:59.999Z');

  // Upsert by the unique [userCardId, name] constraint
  await prisma.userBenefit.upsert({
    where: {
      userCardId_name: {
        userCardId: primaryPlatinum.id,
        name: 'Spend $4,000 for 35,000 Points',
      },
    },
    update: {
      isUsed: false,
      resetCadence: 'OneTime',
      expirationDate: signUpBonusExpiration,
    },
    create: {
      userCardId: primaryPlatinum.id,
      playerId: primaryPlayer.id,
      name: 'Spend $4,000 for 35,000 Points',
      type: 'UsagePerk',
      stickerValue: 0, // Points value varies; user can set userDeclaredValue
      resetCadence: 'OneTime',
      isUsed: false,
      expirationDate: signUpBonusExpiration,
    },
  });

  console.log(`  ✅ Sign-up bonus: "Spend $4,000 for 35,000 Points"`);
  console.log(`     Expires: ${signUpBonusExpiration.toDateString()} (90 days from Jan 24 2026)`);

  // ── Summary ─────────────────────────────────────────────────────────────────
  const [cardCount, benefitCount] = await Promise.all([
    prisma.masterCard.count(),
    prisma.masterBenefit.count(),
  ]);

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌱 Seed complete
   Master Catalog : ${cardCount} cards, ${benefitCount} benefits
   Users          : 1  (test@cardtracker.dev)
   Players        : 2  (Primary, Bethan)
   UserCards      : 3  (2× Primary, 1× Bethan)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
}

main()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
