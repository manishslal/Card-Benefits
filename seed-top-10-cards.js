const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🚀 Seeding top 10 credit cards with benefits...\n');

    // Top 10 credit cards with benefits
    const cardsData = [
      {
        issuer: 'Chase',
        cardName: 'Chase Sapphire Reserve',
        defaultAnnualFee: 55000,
        cardImageUrl: 'https://creditcards.chase.com/images/sapphire-reserve.png',
        benefits: [
          { name: '$300 Travel Credit', type: 'StatementCredit', stickerValue: 30000, resetCadence: 'CalendarYear' },
          { name: '3x Points on Travel & Dining', type: 'Rewards', stickerValue: 20000, resetCadence: 'None' },
          { name: 'Priority Pass Lounge Access', type: 'TravelPerk', stickerValue: 50000, resetCadence: 'CardmemberYear' },
          { name: 'Trip Cancellation Insurance', type: 'Insurance', stickerValue: 10000, resetCadence: 'TripBased' },
          { name: 'Concierge Service', type: 'Service', stickerValue: 5000, resetCadence: 'None' },
        ],
      },
      {
        issuer: 'American Express',
        cardName: 'American Express Platinum',
        defaultAnnualFee: 69900,
        cardImageUrl: 'https://www.americanexpress.com/images/platinum.png',
        benefits: [
          { name: '$200 Airline Credit', type: 'StatementCredit', stickerValue: 20000, resetCadence: 'CalendarYear' },
          { name: '$200 Uber Cash', type: 'StatementCredit', stickerValue: 20000, resetCadence: 'CalendarYear' },
          { name: '$100 Hotel Credit', type: 'StatementCredit', stickerValue: 10000, resetCadence: 'CalendarYear' },
          { name: 'Centurion Lounge Access', type: 'TravelPerk', stickerValue: 60000, resetCadence: 'CardmemberYear' },
          { name: 'Global Dining Access', type: 'Perk', stickerValue: 15000, resetCadence: 'None' },
        ],
      },
      {
        issuer: 'American Express',
        cardName: 'American Express Gold Card',
        defaultAnnualFee: 25000,
        cardImageUrl: 'https://www.americanexpress.com/images/gold-card.png',
        benefits: [
          { name: '$10 Monthly Uber Cash', type: 'StatementCredit', stickerValue: 12000, resetCadence: 'Monthly' },
          { name: '$100 Annual Dining Credit', type: 'StatementCredit', stickerValue: 10000, resetCadence: 'CalendarYear' },
          { name: '4x Points on Dining', type: 'Rewards', stickerValue: 25000, resetCadence: 'None' },
          { name: '4x Points on Flights', type: 'Rewards', stickerValue: 20000, resetCadence: 'None' },
          { name: 'Purchase Protection', type: 'Protection', stickerValue: 8000, resetCadence: 'None' },
        ],
      },
      {
        issuer: 'Chase',
        cardName: 'Chase Sapphire Preferred',
        defaultAnnualFee: 9500,
        cardImageUrl: 'https://creditcards.chase.com/images/sapphire-preferred.png',
        benefits: [
          { name: '3x Points on Travel & Dining', type: 'Rewards', stickerValue: 15000, resetCadence: 'None' },
          { name: 'Trip Cancellation Insurance', type: 'Insurance', stickerValue: 8000, resetCadence: 'TripBased' },
          { name: 'Lost Luggage Reimbursement', type: 'Insurance', stickerValue: 5000, resetCadence: 'TripBased' },
          { name: 'Purchase Protection', type: 'Protection', stickerValue: 10000, resetCadence: 'None' },
          { name: '1% Rewards Bonus on Ultimate Rewards', type: 'Rewards', stickerValue: 5000, resetCadence: 'None' },
        ],
      },
      {
        issuer: 'Capital One',
        cardName: 'Capital One Venture X',
        defaultAnnualFee: 39500,
        cardImageUrl: 'https://www.capitalone.com/images/venture-x.png',
        benefits: [
          { name: '$300 Annual Travel Credit', type: 'StatementCredit', stickerValue: 30000, resetCadence: 'CalendarYear' },
          { name: '10,000 Bonus Miles', type: 'Rewards', stickerValue: 10000, resetCadence: 'Signup' },
          { name: 'Priority Pass Lounge', type: 'TravelPerk', stickerValue: 40000, resetCadence: 'CardmemberYear' },
          { name: '2x Miles on All Purchases', type: 'Rewards', stickerValue: 18000, resetCadence: 'None' },
          { name: 'Baggage Fee Credit', type: 'TravelPerk', stickerValue: 8000, resetCadence: 'CalendarYear' },
        ],
      },
      {
        issuer: 'Citi',
        cardName: 'Citi Prestige',
        defaultAnnualFee: 45000,
        cardImageUrl: 'https://www.citi.com/images/prestige.png',
        benefits: [
          { name: '$250 Travel Credit', type: 'StatementCredit', stickerValue: 25000, resetCadence: 'CalendarYear' },
          { name: 'Fourth Night Free on Hotels', type: 'TravelPerk', stickerValue: 35000, resetCadence: 'None' },
          { name: 'Complimentary Airport Meet & Greet', type: 'Service', stickerValue: 12000, resetCadence: 'CalendarYear' },
          { name: 'Priority Pass Lounge', type: 'TravelPerk', stickerValue: 45000, resetCadence: 'CardmemberYear' },
          { name: 'Trip Cancellation Insurance', type: 'Insurance', stickerValue: 10000, resetCadence: 'TripBased' },
        ],
      },
      {
        issuer: 'Bank of America',
        cardName: 'Bank of America Premium Rewards',
        defaultAnnualFee: 0,
        cardImageUrl: 'https://www.bankofamerica.com/images/premium-rewards.png',
        benefits: [
          { name: '2.625% Cash Back on All Purchases', type: 'CashBack', stickerValue: 26250, resetCadence: 'None' },
          { name: 'Preferred Rewards Bonus', type: 'Rewards', stickerValue: 5000, resetCadence: 'Annual' },
          { name: 'Purchase Protection', type: 'Protection', stickerValue: 8000, resetCadence: 'None' },
          { name: 'Extended Warranty', type: 'Protection', stickerValue: 6000, resetCadence: 'None' },
        ],
      },
      {
        issuer: 'Discover',
        cardName: 'Discover It Business',
        defaultAnnualFee: 0,
        cardImageUrl: 'https://www.discover.com/images/it-business.png',
        benefits: [
          { name: '5% Cash Back on Business Purchases', type: 'CashBack', stickerValue: 25000, resetCadence: 'Quarterly' },
          { name: '1% Cash Back Everything Else', type: 'CashBack', stickerValue: 10000, resetCadence: 'None' },
          { name: 'Cashback Match First Year', type: 'Rewards', stickerValue: 12500, resetCadence: 'FirstYear' },
          { name: 'No Annual Fee', type: 'Fee', stickerValue: 0, resetCadence: 'None' },
        ],
      },
      {
        issuer: 'Wells Fargo',
        cardName: 'Wells Fargo Propel American Express',
        defaultAnnualFee: 0,
        cardImageUrl: 'https://www.wellsfargo.com/images/propel-amex.png',
        benefits: [
          { name: '3x Points on Travel & Dining', type: 'Rewards', stickerValue: 20000, resetCadence: 'None' },
          { name: '3x Points on Streaming', type: 'Rewards', stickerValue: 12000, resetCadence: 'None' },
          { name: '1x Points Everything Else', type: 'Rewards', stickerValue: 8000, resetCadence: 'None' },
          { name: 'Purchase Protection', type: 'Protection', stickerValue: 7000, resetCadence: 'None' },
        ],
      },
      {
        issuer: 'Barclays',
        cardName: 'Barclays Arrival Plus World Elite Mastercard',
        defaultAnnualFee: 9500,
        cardImageUrl: 'https://www.barclays.com/images/arrival-plus.png',
        benefits: [
          { name: '2x Miles on All Purchases', type: 'Rewards', stickerValue: 18000, resetCadence: 'None' },
          { name: 'Baggage Fee Credit', type: 'TravelPerk', stickerValue: 8000, resetCadence: 'CalendarYear' },
          { name: 'Trip Delay Reimbursement', type: 'Insurance', stickerValue: 5000, resetCadence: 'TripBased' },
          { name: 'World Elite Perks', type: 'Perk', stickerValue: 10000, resetCadence: 'None' },
        ],
      },
    ];

    let cardsCreated = 0;
    let benefitsCreated = 0;

    for (const cardData of cardsData) {
      try {
        const masterCard = await prisma.masterCard.create({
          data: {
            issuer: cardData.issuer,
            cardName: cardData.cardName,
            defaultAnnualFee: cardData.defaultAnnualFee,
            cardImageUrl: cardData.cardImageUrl,
          },
        });

        cardsCreated++;

        if (cardData.benefits && cardData.benefits.length > 0) {
          await prisma.masterBenefit.createMany({
            data: cardData.benefits.map((benefit) => ({
              masterCardId: masterCard.id,
              ...benefit,
            })),
          });
          benefitsCreated += cardData.benefits.length;
        }

        console.log(`✅ ${cardData.cardName} (${cardData.issuer})`);
      } catch (error) {
        if (error.code === 'P2002') {
          console.log(`⚠️  ${cardData.cardName} already exists, skipping...`);
        } else {
          console.error(`❌ Error creating ${cardData.cardName}:`, error.message);
        }
      }
    }

    console.log(`\n✨ SEED COMPLETE!`);
    console.log(`📊 Cards Created: ${cardsCreated}`);
    console.log(`💰 Benefits Created: ${benefitsCreated}`);
  } catch (error) {
    console.error('❌ Seed failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
