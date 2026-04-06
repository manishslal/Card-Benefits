const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // ============================================================================
  // April 2026 Points-Based Credit Cards Seed Data (UPDATED VERSION)
  // ============================================================================
  // IMPORTANT: All values are stored in the database as CENTS (for consistency)
  // but are documented in dollar amounts for clarity.
  // Example: $795 annual fee = 79500 (cents in database)
  // Example: $300 benefit = 30000 (cents in database)
  // ============================================================================

  const cardsData = [
    // ========================================================================
    // CHASE PREMIUM TRAVEL CARDS (Sapphire Series)
    // ========================================================================

    {
      issuer: 'Chase',
      cardName: 'Chase Sapphire Reserve',
      defaultAnnualFee: 79500, // $795 (increased from $550 in 2024)
      cardImageUrl:
        'https://creditcards.chaseonline.com/images/cardart/CSR_card_art.png',
      benefits: [
        {
          name: '$300 Annual Travel Credit',
          type: 'StatementCredit',
          stickerValue: 30000, // $300
          resetCadence: 'CalendarYear',
        },
        {
          name: '$500 The Edit Hotel Credit',
          type: 'StatementCredit',
          stickerValue: 50000, // $500 (NEW for 2026)
          resetCadence: 'CalendarYear',
        },
        {
          name: '$250 Hotel Chain Credit',
          type: 'StatementCredit',
          stickerValue: 25000, // $250 (NEW for 2026)
          resetCadence: 'CalendarYear',
        },
        {
          name: '$300 Dining Credit',
          type: 'StatementCredit',
          stickerValue: 30000, // $300 (NEW for 2026)
          resetCadence: 'CalendarYear',
        },
        {
          name: '$300 Entertainment Credit',
          type: 'StatementCredit',
          stickerValue: 30000, // $300 (NEW for 2026)
          resetCadence: 'CalendarYear',
        },
        {
          name: 'Priority Pass Select Lounge Access',
          type: 'TravelPerk',
          stickerValue: 27000, // ~$270 annual value
          resetCadence: 'CalendarYear',
        },
        {
          name: 'Trip Cancellation Insurance',
          type: 'Insurance',
          stickerValue: 10000, // ~$100 per trip
          resetCadence: 'TripBased',
        },
        {
          name: 'Lost Luggage Reimbursement',
          type: 'Insurance',
          stickerValue: 500000, // $5000 coverage
          resetCadence: 'TripBased',
        },
        {
          name: 'Global Entry or TSA PreCheck Credit',
          type: 'StatementCredit',
          stickerValue: 10500, // $105 (once every 4-5 years)
          resetCadence: 'FirstYear',
        },
      ],
    },

    {
      issuer: 'Chase',
      cardName: 'Chase Sapphire Preferred',
      defaultAnnualFee: 9500, // $95
      cardImageUrl:
        'https://creditcards.chaseonline.com/images/cardart/CSP_card_art.png',
      benefits: [
        {
          name: '3x Points on Travel & Dining',
          type: 'Rewards',
          stickerValue: 0,
          resetCadence: 'None',
        },
        {
          name: 'Ultimate Rewards Flexible Redemption',
          type: 'Rewards',
          stickerValue: 0,
          resetCadence: 'None',
        },
        {
          name: 'Trip Cancellation Insurance',
          type: 'Insurance',
          stickerValue: 10000,
          resetCadence: 'TripBased',
        },
        {
          name: 'Trip Delay Reimbursement',
          type: 'Insurance',
          stickerValue: 50000,
          resetCadence: 'TripBased',
        },
        {
          name: 'Emergency Medical & Dental',
          type: 'Insurance',
          stickerValue: 50000,
          resetCadence: 'TripBased',
        },
        {
          name: 'Purchase Protection',
          type: 'Protection',
          stickerValue: 0,
          resetCadence: 'None',
        },
      ],
    },

    // ========================================================================
    // AMERICAN EXPRESS PREMIUM CARDS
    // ========================================================================

    {
      issuer: 'American Express',
      cardName: 'American Express Platinum Card',
      defaultAnnualFee: 89500, // $895 (increased from $695 in 2024)
      cardImageUrl:
        'https://www.americanexpress.com/content/dam/amex/us/credit-cards/images/learn/plat_cardart_375x237.jpg',
      benefits: [
        {
          name: '$600 Annual Hotel Credit',
          type: 'StatementCredit',
          stickerValue: 60000,
          resetCadence: 'CalendarYear',
        },
        {
          name: '$400 Resy Dining Credit',
          type: 'StatementCredit',
          stickerValue: 40000,
          resetCadence: 'CalendarYear',
        },
        {
          name: '$300 Entertainment Credit',
          type: 'StatementCredit',
          stickerValue: 30000,
          resetCadence: 'CalendarYear',
        },
        {
          name: '$300 Lululemon Annual Credit',
          type: 'StatementCredit',
          stickerValue: 30000,
          resetCadence: 'CalendarYear',
        },
        {
          name: '$200 Uber Annual Credit',
          type: 'StatementCredit',
          stickerValue: 20000,
          resetCadence: 'CalendarYear',
        },
        {
          name: '$209 CLEAR Annual Credit',
          type: 'StatementCredit',
          stickerValue: 20900,
          resetCadence: 'CalendarYear',
        },
        {
          name: 'Centurion Lounge Access',
          type: 'TravelPerk',
          stickerValue: 50000,
          resetCadence: 'CalendarYear',
        },
        {
          name: 'Complimentary Airport Meet & Greet',
          type: 'TravelPerk',
          stickerValue: 5000,
          resetCadence: 'TripBased',
        },
        {
          name: 'Global Entry or TSA PreCheck',
          type: 'StatementCredit',
          stickerValue: 10500,
          resetCadence: 'FirstYear',
        },
        {
          name: 'Fine Hotels & Resorts Partner Program',
          type: 'TravelPerk',
          stickerValue: 20000,
          resetCadence: 'CalendarYear',
        },
      ],
    },

    {
      issuer: 'American Express',
      cardName: 'American Express Gold Card',
      defaultAnnualFee: 32500, // $325 (increased from $250 in 2024)
      cardImageUrl:
        'https://www.americanexpress.com/content/dam/amex/us/credit-cards/images/learn/gold_cardart_375x237.jpg',
      benefits: [
        {
          name: '4x Points on Dining & Restaurants',
          type: 'Rewards',
          stickerValue: 0,
          resetCadence: 'None',
        },
        {
          name: '4x Points on Flights',
          type: 'Rewards',
          stickerValue: 0,
          resetCadence: 'None',
        },
        {
          name: '$120 Annual Dining Credit',
          type: 'StatementCredit',
          stickerValue: 12000,
          resetCadence: 'CalendarYear',
        },
        {
          name: '$100 Annual Uber Credit',
          type: 'StatementCredit',
          stickerValue: 10000,
          resetCadence: 'CalendarYear',
        },
        {
          name: 'Purchase Protection',
          type: 'Protection',
          stickerValue: 0,
          resetCadence: 'None',
        },
      ],
    },
  ];

  console.log(`\n🚀 APRIL 2026 CARD DATA UPDATE\n`);
  console.log(`💾 Updating existing cards with April 2026 data...\n`);

  let successCount = 0;
  let errorCount = 0;

  // Update existing cards with April 2026 data
  for (const cardData of cardsData) {
    try {
      // Find existing card
      const existingCard = await prisma.masterCard.findUnique({
        where: {
          issuer_cardName: {
            issuer: cardData.issuer,
            cardName: cardData.cardName,
          },
        },
      });

      if (existingCard) {
        // Update the card with new annual fee
        await prisma.masterCard.update({
          where: { id: existingCard.id },
          data: {
            defaultAnnualFee: cardData.defaultAnnualFee,
          },
        });

        // Delete old benefits
        await prisma.masterBenefit.deleteMany({
          where: { masterCardId: existingCard.id },
        });

        // Create new benefits
        if (cardData.benefits && cardData.benefits.length > 0) {
          await prisma.masterBenefit.createMany({
            data: cardData.benefits.map((benefit) => ({
              masterCardId: existingCard.id,
              ...benefit,
            })),
          });
        }

        console.log(
          `✅ ${cardData.cardName} - Updated with April 2026 data`
        );
        successCount++;
      }
    } catch (error) {
      console.error(
        `❌ Error updating ${cardData.cardName}:`,
        error.message
      );
      errorCount++;
    }
  }

  console.log(`\n✨ Update complete!`);
  console.log(`   Updated: ${successCount} cards`);
  if (errorCount > 0) console.log(`   Errors: ${errorCount} cards`);

  const totalBenefits = cardsData.reduce(
    (acc, card) => acc + (card.benefits?.length || 0),
    0
  );
  console.log(`   Total benefits: ${totalBenefits}\n`);

  // Verify the updates
  console.log('📊 APRIL 2026 VERIFICATION:');
  const updatedCards = await prisma.masterCard.findMany({
    where: {
      cardName: {
        in: ['Chase Sapphire Reserve', 'American Express Platinum Card'],
      },
    },
    include: {
      masterBenefits: {
        select: { name: true, stickerValue: true },
      },
    },
  });

  updatedCards.forEach((card) => {
    const dollarFee = (card.defaultAnnualFee / 100).toFixed(2);
    console.log(`\n   ${card.cardName}`);
    console.log(`   Annual Fee: $${dollarFee}`);
    console.log(`   Benefits: ${card.masterBenefits.length}`);
  });

  console.log('\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
