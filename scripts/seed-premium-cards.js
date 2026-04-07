const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// 26+ PREMIUM POINTS-BASED CREDIT CARDS WITH BENEFITS
const PREMIUM_CARDS = [
  // CHASE SAPPHIRE SERIES
  {
    issuer: 'Chase',
    cardName: 'Chase Sapphire Reserve',
    defaultAnnualFee: 79500,
    benefits: [
      { name: '$300 Annual Travel Credit', type: 'StatementCredit', stickerValue: 30000, resetCadence: 'CalendarYear' },
      { name: '$500 The Edit Hotel Credit', type: 'StatementCredit', stickerValue: 50000, resetCadence: 'CalendarYear' },
      { name: '$250 Hotel Chain Credit', type: 'StatementCredit', stickerValue: 25000, resetCadence: 'CalendarYear' },
      { name: '$300 Dining Credit', type: 'StatementCredit', stickerValue: 30000, resetCadence: 'CalendarYear' },
      { name: '$300 Entertainment Credit', type: 'StatementCredit', stickerValue: 30000, resetCadence: 'CalendarYear' },
      { name: 'Priority Pass Select Lounge Access', type: 'TravelPerk', stickerValue: 27000, resetCadence: 'CalendarYear' },
      { name: 'Trip Cancellation Insurance', type: 'Insurance', stickerValue: 10000, resetCadence: 'TripBased' },
      { name: 'Lost Luggage Reimbursement', type: 'Insurance', stickerValue: 500000, resetCadence: 'TripBased' },
      { name: 'Global Entry or TSA PreCheck Credit', type: 'StatementCredit', stickerValue: 10500, resetCadence: 'FirstYear' },
    ],
  },
  {
    issuer: 'Chase',
    cardName: 'Chase Sapphire Preferred',
    defaultAnnualFee: 9500,
    benefits: [
      { name: '3x Points on Travel & Dining', type: 'Rewards', stickerValue: 0, resetCadence: 'None' },
      { name: 'Ultimate Rewards Flexible Redemption', type: 'Rewards', stickerValue: 0, resetCadence: 'None' },
      { name: 'Trip Cancellation Insurance', type: 'Insurance', stickerValue: 10000, resetCadence: 'TripBased' },
      { name: 'Trip Delay Reimbursement', type: 'Insurance', stickerValue: 50000, resetCadence: 'TripBased' },
      { name: 'Emergency Medical & Dental', type: 'Insurance', stickerValue: 50000, resetCadence: 'TripBased' },
      { name: 'Purchase Protection', type: 'Protection', stickerValue: 0, resetCadence: 'None' },
    ],
  },

  // AMERICAN EXPRESS PREMIUM
  {
    issuer: 'American Express',
    cardName: 'American Express Platinum Card',
    defaultAnnualFee: 89500,
    benefits: [
      { name: '$600 Annual Hotel Credit', type: 'StatementCredit', stickerValue: 60000, resetCadence: 'CalendarYear' },
      { name: '$400 Resy Dining Credit', type: 'StatementCredit', stickerValue: 40000, resetCadence: 'CalendarYear' },
      { name: '$300 Entertainment Credit', type: 'StatementCredit', stickerValue: 30000, resetCadence: 'CalendarYear' },
      { name: '$300 Lululemon Annual Credit', type: 'StatementCredit', stickerValue: 30000, resetCadence: 'CalendarYear' },
      { name: '$200 Uber Annual Credit', type: 'StatementCredit', stickerValue: 20000, resetCadence: 'CalendarYear' },
      { name: '$209 CLEAR Annual Credit', type: 'StatementCredit', stickerValue: 20900, resetCadence: 'CalendarYear' },
      { name: 'Centurion Lounge Access', type: 'TravelPerk', stickerValue: 50000, resetCadence: 'CalendarYear' },
      { name: 'Complimentary Airport Meet & Greet', type: 'TravelPerk', stickerValue: 5000, resetCadence: 'TripBased' },
      { name: 'Global Entry or TSA PreCheck', type: 'StatementCredit', stickerValue: 10500, resetCadence: 'FirstYear' },
      { name: 'Fine Hotels & Resorts Partner Program', type: 'TravelPerk', stickerValue: 20000, resetCadence: 'CalendarYear' },
    ],
  },
  {
    issuer: 'American Express',
    cardName: 'American Express Gold Card',
    defaultAnnualFee: 32500,
    benefits: [
      { name: '4x Points on Dining & Restaurants', type: 'Rewards', stickerValue: 0, resetCadence: 'None' },
      { name: '4x Points on Flights', type: 'Rewards', stickerValue: 0, resetCadence: 'None' },
      { name: '$120 Annual Dining Credit', type: 'StatementCredit', stickerValue: 12000, resetCadence: 'CalendarYear' },
      { name: '$100 Annual Uber Credit', type: 'StatementCredit', stickerValue: 10000, resetCadence: 'CalendarYear' },
      { name: 'Purchase Protection', type: 'Protection', stickerValue: 0, resetCadence: 'None' },
    ],
  },
  {
    issuer: 'American Express',
    cardName: 'American Express Green Card',
    defaultAnnualFee: 15000,
    benefits: [
      { name: '3x Membership Rewards on Travel', type: 'Rewards', stickerValue: 0, resetCadence: 'None' },
      { name: '1x Membership Rewards on All Other Purchases', type: 'Rewards', stickerValue: 0, resetCadence: 'None' },
      { name: 'Statement Credits for Travel', type: 'StatementCredit', stickerValue: 10000, resetCadence: 'CalendarYear' },
    ],
  },
  {
    issuer: 'American Express',
    cardName: 'American Express Business Gold Card',
    defaultAnnualFee: 29500,
    benefits: [
      { name: '4x Membership Rewards on Business Purchases', type: 'Rewards', stickerValue: 0, resetCadence: 'None' },
      { name: '1x Membership Rewards on All Other Purchases', type: 'Rewards', stickerValue: 0, resetCadence: 'None' },
      { name: 'Business Expense Tracking', type: 'Service', stickerValue: 0, resetCadence: 'None' },
    ],
  },
  {
    issuer: 'American Express',
    cardName: 'American Express Hilton Honors Surpass Card',
    defaultAnnualFee: 15000,
    benefits: [
      { name: 'Free Night Award Certificate', type: 'TravelPerk', stickerValue: 30000, resetCadence: 'CardmemberYear' },
      { name: '10x Points on Hilton Hotels', type: 'Rewards', stickerValue: 0, resetCadence: 'None' },
      { name: 'Complimentary Room Upgrades', type: 'TravelPerk', stickerValue: 5000, resetCadence: 'CalendarYear' },
      { name: 'Airline Fee Credit', type: 'StatementCredit', stickerValue: 15000, resetCadence: 'CalendarYear' },
    ],
  },
  {
    issuer: 'American Express',
    cardName: 'American Express Marriott Bonvoy Brilliant Credit Card',
    defaultAnnualFee: 12500,
    benefits: [
      { name: 'Free Night Award Certificate', type: 'TravelPerk', stickerValue: 25000, resetCadence: 'CardmemberYear' },
      { name: '6x Points on Marriott Hotels', type: 'Rewards', stickerValue: 0, resetCadence: 'None' },
      { name: 'Elite Night Credits', type: 'TravelPerk', stickerValue: 10000, resetCadence: 'CalendarYear' },
      { name: 'Airline Fee Credit', type: 'StatementCredit', stickerValue: 30000, resetCadence: 'CalendarYear' },
    ],
  },

  // CAPITAL ONE
  {
    issuer: 'Capital One',
    cardName: 'Capital One Venture X',
    defaultAnnualFee: 39500,
    benefits: [
      { name: '$300 Annual Travel Credit', type: 'StatementCredit', stickerValue: 30000, resetCadence: 'CalendarYear' },
      { name: '10x Miles on Travel & Dining', type: 'Rewards', stickerValue: 0, resetCadence: 'None' },
      { name: 'Priority Pass Lounge', type: 'TravelPerk', stickerValue: 40000, resetCadence: 'CardmemberYear' },
      { name: '2x Miles on All Purchases', type: 'Rewards', stickerValue: 0, resetCadence: 'None' },
      { name: 'Baggage Fee Credit', type: 'TravelPerk', stickerValue: 8000, resetCadence: 'CalendarYear' },
    ],
  },
  {
    issuer: 'Capital One',
    cardName: 'Capital One Venture',
    defaultAnnualFee: 0,
    benefits: [
      { name: '2x Miles on All Purchases', type: 'Rewards', stickerValue: 0, resetCadence: 'None' },
      { name: 'Mile Redemption Flexibility', type: 'Rewards', stickerValue: 0, resetCadence: 'None' },
      { name: 'Purchase Protection', type: 'Protection', stickerValue: 0, resetCadence: 'None' },
    ],
  },

  // CHASE BUSINESS & FREEDOM
  {
    issuer: 'Chase',
    cardName: 'Chase Ink Preferred Business',
    defaultAnnualFee: 9500,
    benefits: [
      { name: '3x Points on Business Purchases', type: 'Rewards', stickerValue: 0, resetCadence: 'None' },
      { name: 'Business Expense Tracking', type: 'Service', stickerValue: 0, resetCadence: 'None' },
      { name: 'Purchase Protection', type: 'Protection', stickerValue: 0, resetCadence: 'None' },
    ],
  },
  {
    issuer: 'Chase',
    cardName: 'Chase Ink Business Premier',
    defaultAnnualFee: 0,
    benefits: [
      { name: '2x Points on Business Purchases', type: 'Rewards', stickerValue: 0, resetCadence: 'None' },
      { name: '1x Points on All Other Purchases', type: 'Rewards', stickerValue: 0, resetCadence: 'None' },
      { name: 'Business Tools & Resources', type: 'Service', stickerValue: 0, resetCadence: 'None' },
    ],
  },
  {
    issuer: 'Chase',
    cardName: 'Chase Ink Unlimited Business',
    defaultAnnualFee: 0,
    benefits: [
      { name: '1.5x Points on All Purchases', type: 'Rewards', stickerValue: 0, resetCadence: 'None' },
      { name: 'Purchase Protection', type: 'Protection', stickerValue: 0, resetCadence: 'None' },
    ],
  },
  {
    issuer: 'Chase',
    cardName: 'Chase Freedom Flex',
    defaultAnnualFee: 0,
    benefits: [
      { name: '5% Cash Back on Rotating Categories', type: 'CashBack', stickerValue: 0, resetCadence: 'Quarterly' },
      { name: '1% Cash Back on All Other Purchases', type: 'CashBack', stickerValue: 0, resetCadence: 'None' },
    ],
  },
  {
    issuer: 'Chase',
    cardName: 'Chase Freedom Unlimited',
    defaultAnnualFee: 0,
    benefits: [
      { name: '1.5x Cash Back on All Purchases', type: 'CashBack', stickerValue: 0, resetCadence: 'None' },
      { name: 'Intro 0% APR for 15 months', type: 'Perk', stickerValue: 0, resetCadence: 'OneTime' },
    ],
  },
  {
    issuer: 'Chase',
    cardName: 'Chase Southwest Rapid Rewards Premier',
    defaultAnnualFee: 6999,
    benefits: [
      { name: 'Free Checked Bags', type: 'TravelPerk', stickerValue: 30000, resetCadence: 'CalendarYear' },
      { name: '2x Points on Southwest Flights', type: 'Rewards', stickerValue: 0, resetCadence: 'None' },
      { name: 'Complimentary Boarding', type: 'TravelPerk', stickerValue: 5000, resetCadence: 'CalendarYear' },
    ],
  },

  // AIRLINE & HOTEL
  {
    issuer: 'United',
    cardName: 'United Airlines Explorer Card',
    defaultAnnualFee: 0,
    benefits: [
      { name: 'Free Checked Bag', type: 'TravelPerk', stickerValue: 30000, resetCadence: 'CalendarYear' },
      { name: '2x Miles on United Flights', type: 'Rewards', stickerValue: 0, resetCadence: 'None' },
      { name: 'Priority Boarding', type: 'TravelPerk', stickerValue: 5000, resetCadence: 'CalendarYear' },
    ],
  },
  {
    issuer: 'Chase',
    cardName: 'Chase Hyatt Credit Card',
    defaultAnnualFee: 9500,
    benefits: [
      { name: 'Free Night Award', type: 'TravelPerk', stickerValue: 30000, resetCadence: 'CardmemberYear' },
      { name: '4x Points on Hyatt Hotels', type: 'Rewards', stickerValue: 0, resetCadence: 'None' },
      { name: 'Elite Night Credits', type: 'TravelPerk', stickerValue: 10000, resetCadence: 'CalendarYear' },
    ],
  },

  // WELLS FARGO
  {
    issuer: 'Wells Fargo',
    cardName: 'Wells Fargo Propel American Express',
    defaultAnnualFee: 0,
    benefits: [
      { name: '3x Points on Travel & Dining', type: 'Rewards', stickerValue: 0, resetCadence: 'None' },
      { name: '3x Points on Streaming', type: 'Rewards', stickerValue: 0, resetCadence: 'None' },
      { name: '1x Point on All Other Purchases', type: 'Rewards', stickerValue: 0, resetCadence: 'None' },
    ],
  },
  {
    issuer: 'Wells Fargo',
    cardName: 'Wells Fargo Active Cash',
    defaultAnnualFee: 0,
    benefits: [
      { name: '2% Unlimited Cash Back', type: 'CashBack', stickerValue: 0, resetCadence: 'None' },
      { name: 'No Rotating Categories', type: 'Perk', stickerValue: 0, resetCadence: 'None' },
    ],
  },

  // US BANK
  {
    issuer: 'US Bank',
    cardName: 'US Bank Altitude Reserve Visa Infinite',
    defaultAnnualFee: 39500,
    benefits: [
      { name: '$300 Quarterly Travel Credit', type: 'StatementCredit', stickerValue: 75000, resetCadence: 'CalendarYear' },
      { name: '4.5x Points on Travel & Dining', type: 'Rewards', stickerValue: 0, resetCadence: 'None' },
      { name: 'Priority Pass Select', type: 'TravelPerk', stickerValue: 40000, resetCadence: 'CalendarYear' },
    ],
  },
  {
    issuer: 'US Bank',
    cardName: 'US Bank Altitude Go Visa Signature',
    defaultAnnualFee: 0,
    benefits: [
      { name: '4x Points on Travel & Dining', type: 'Rewards', stickerValue: 0, resetCadence: 'None' },
      { name: '2x Points on Other Purchases', type: 'Rewards', stickerValue: 0, resetCadence: 'None' },
    ],
  },

  // BARCLAYS
  {
    issuer: 'Barclays',
    cardName: 'Barclays JetBlue Plus Card',
    defaultAnnualFee: 9500,
    benefits: [
      { name: '3x Points on JetBlue Flights', type: 'Rewards', stickerValue: 0, resetCadence: 'None' },
      { name: 'Free Checked Bags', type: 'TravelPerk', stickerValue: 30000, resetCadence: 'CalendarYear' },
      { name: 'Inflight Free Drinks & Snacks', type: 'TravelPerk', stickerValue: 5000, resetCadence: 'CalendarYear' },
    ],
  },

  // CITI
  {
    issuer: 'Citi',
    cardName: 'Citi Prestige Card',
    defaultAnnualFee: 49500,
    benefits: [
      { name: 'Travel Credit', type: 'StatementCredit', stickerValue: 25000, resetCadence: 'CalendarYear' },
      { name: '3x Prestige Points on Travel', type: 'Rewards', stickerValue: 0, resetCadence: 'None' },
      { name: 'Fourth Night Free at Hotels', type: 'TravelPerk', stickerValue: 50000, resetCadence: 'CalendarYear' },
      { name: 'Concierge Services', type: 'Service', stickerValue: 5000, resetCadence: 'CalendarYear' },
    ],
  },
  {
    issuer: 'Citi',
    cardName: 'Citi Custom Cash Card',
    defaultAnnualFee: 0,
    benefits: [
      { name: '5% Cash Back on Your Top Spending Category', type: 'CashBack', stickerValue: 0, resetCadence: 'Monthly' },
      { name: '1% Cash Back on All Other Purchases', type: 'CashBack', stickerValue: 0, resetCadence: 'None' },
    ],
  },

  // DISCOVER
  {
    issuer: 'Discover',
    cardName: 'Discover it Card',
    defaultAnnualFee: 0,
    benefits: [
      { name: '5% Cash Back on Rotating Categories', type: 'CashBack', stickerValue: 0, resetCadence: 'Quarterly' },
      { name: '1% Cash Back on All Other Purchases', type: 'CashBack', stickerValue: 0, resetCadence: 'None' },
      { name: 'Cashback Match (First Year)', type: 'CashBack', stickerValue: 0, resetCadence: 'FirstYear' },
    ],
  },
];

async function main() {
  console.log('\n📊 PREMIUM CARDS SEED - 26+ Premium Points Credit Cards\n');
  
  let created = 0;
  let updated = 0;
  let benefitsCreated = 0;

  for (const card of PREMIUM_CARDS) {
    try {
      const existing = await prisma.masterCard.findUnique({
        where: { issuer_cardName: { issuer: card.issuer, cardName: card.cardName } },
      });

      if (existing) {
        // Update existing card
        await prisma.masterCard.update({
          where: { id: existing.id },
          data: { defaultAnnualFee: card.defaultAnnualFee },
        });

        // Delete and recreate benefits
        await prisma.masterBenefit.deleteMany({ where: { masterCardId: existing.id } });
        await prisma.masterBenefit.createMany({
          data: card.benefits.map(b => ({
            masterCardId: existing.id,
            ...b,
          })),
        });

        console.log(`  ✅ UPDATED: ${card.cardName} (${card.benefits.length} benefits)`);
        updated++;
        benefitsCreated += card.benefits.length;
      } else {
        // Create new card
        const newCard = await prisma.masterCard.create({
          data: {
            issuer: card.issuer,
            cardName: card.cardName,
            defaultAnnualFee: card.defaultAnnualFee,
            cardImageUrl: '',
          },
        });

        await prisma.masterBenefit.createMany({
          data: card.benefits.map(b => ({
            masterCardId: newCard.id,
            ...b,
          })),
        });

        console.log(`  ✨ CREATED: ${card.cardName} (${card.benefits.length} benefits)`);
        created++;
        benefitsCreated += card.benefits.length;
      }
    } catch (error) {
      console.error(`  ❌ Error with ${card.cardName}:`, error.message);
    }
  }

  const totalCards = await prisma.masterCard.count();
  const totalBenefits = await prisma.masterBenefit.count();

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ PREMIUM CARDS SEED COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Cards Created   : ${created}
   Cards Updated   : ${updated}
   Benefits Added  : ${benefitsCreated}
   Total Cards DB  : ${totalCards}
   Total Benefits  : ${totalBenefits}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

main()
  .catch(e => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
