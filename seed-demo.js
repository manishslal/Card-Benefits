const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.userBenefit.deleteMany();
    await prisma.userCard.deleteMany();
    await prisma.masterBenefit.deleteMany();
    await prisma.masterCard.deleteMany();
    await prisma.player.deleteMany();
    await prisma.user.deleteMany();

    const user = await prisma.user.create({
      data: { email: 'demo@example.com', passwordHash: 'dummy_hash_for_demo' },
    });

    const player = await prisma.player.create({
      data: { userId: user.id, playerName: 'Primary Cardholder', isActive: true },
    });

    const chaseReserve = await prisma.masterCard.create({
      data: {
        issuer: 'Chase',
        cardName: 'Chase Sapphire Reserve',
        defaultAnnualFee: 55000,
        cardImageUrl: 'https://creditcards.chase.com/images/sapphire-reserve.png',
      },
    });

    const amexGold = await prisma.masterCard.create({
      data: {
        issuer: 'American Express',
        cardName: 'American Express Gold Card',
        defaultAnnualFee: 25000,
        cardImageUrl: 'https://www.americanexpress.com/images/gold-card.png',
      },
    });

    await prisma.masterBenefit.createMany({
      data: [
        { masterCardId: chaseReserve.id, name: '$300 Travel Credit', type: 'StatementCredit', stickerValue: 30000, resetCadence: 'CalendarYear' },
        { masterCardId: chaseReserve.id, name: 'Priority Pass Lounge', type: 'UsagePerk', stickerValue: 50000, resetCadence: 'CardmemberYear' },
        { masterCardId: amexGold.id, name: '$10 Monthly Uber Cash', type: 'StatementCredit', stickerValue: 1000, resetCadence: 'Monthly' },
      ],
    });

    const card1 = await prisma.userCard.create({
      data: { playerId: player.id, masterCardId: chaseReserve.id, customName: 'My Chase Reserve', actualAnnualFee: 55000, renewalDate: new Date(2025, 0, 15), isOpen: true },
    });

    const card2 = await prisma.userCard.create({
      data: { playerId: player.id, masterCardId: amexGold.id, customName: 'My Amex Gold', actualAnnualFee: 25000, renewalDate: new Date(2025, 3, 20), isOpen: true },
    });

    const benefits1 = await prisma.masterBenefit.findMany({ where: { masterCardId: chaseReserve.id } });
    for (const benefit of benefits1) {
      await prisma.userBenefit.create({
        data: {
          userCardId: card1.id,
          playerId: player.id,
          name: benefit.name,
          type: benefit.type,
          stickerValue: benefit.stickerValue,
          resetCadence: benefit.resetCadence,
          isUsed: false,
          timesUsed: 0,
          expirationDate: new Date(2026, 11, 31),
        },
      });
    }

    const benefits2 = await prisma.masterBenefit.findMany({ where: { masterCardId: amexGold.id } });
    for (const benefit of benefits2) {
      await prisma.userBenefit.create({
        data: {
          userCardId: card2.id,
          playerId: player.id,
          name: benefit.name,
          type: benefit.type,
          stickerValue: benefit.stickerValue,
          resetCadence: benefit.resetCadence,
          isUsed: false,
          timesUsed: 0,
          expirationDate: new Date(2026, 11, 31),
        },
      });
    }

    console.log('✅ DATABASE SEEDED SUCCESSFULLY!');
    console.log('\nDemo Account: demo@example.com');
    console.log('Cards: 2 | Benefits: 3');
  } catch (error) {
    console.error('❌ Seed failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
