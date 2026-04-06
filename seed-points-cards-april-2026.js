const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // ============================================================================
  // April 2026 Points-Based Credit Cards Seed Data
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
      signupBonus: '125,000 points (~$1,875 value)',
      loyaltyProgram: 'Chase Ultimate Rewards',
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
          stickerValue: 0, // Incorporated into earn rates
          resetCadence: 'None',
        },
        {
          name: 'Ultimate Rewards Flexible Redemption',
          type: 'Rewards',
          stickerValue: 0, // Built-in benefit
          resetCadence: 'None',
        },
        {
          name: 'Trip Cancellation Insurance',
          type: 'Insurance',
          stickerValue: 10000, // ~$100
          resetCadence: 'TripBased',
        },
        {
          name: 'Trip Delay Reimbursement',
          type: 'Insurance',
          stickerValue: 50000, // $500 coverage
          resetCadence: 'TripBased',
        },
        {
          name: 'Emergency Medical & Dental',
          type: 'Insurance',
          stickerValue: 50000, // $500 emergency dental abroad
          resetCadence: 'TripBased',
        },
        {
          name: 'Purchase Protection',
          type: 'Protection',
          stickerValue: 0, // 120 days
          resetCadence: 'None',
        },
      ],
      signupBonus: '100,000 points (~$1,500 value)',
      loyaltyProgram: 'Chase Ultimate Rewards',
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
          stickerValue: 60000, // $600 (NEW for 2026)
          resetCadence: 'CalendarYear',
        },
        {
          name: '$400 Resy Dining Credit',
          type: 'StatementCredit',
          stickerValue: 40000, // $400 (NEW for 2026)
          resetCadence: 'CalendarYear',
        },
        {
          name: '$300 Entertainment Credit',
          type: 'StatementCredit',
          stickerValue: 30000, // $300 (NEW for 2026)
          resetCadence: 'CalendarYear',
        },
        {
          name: '$300 Lululemon Annual Credit',
          type: 'StatementCredit',
          stickerValue: 30000, // $300 (NEW for 2026)
          resetCadence: 'CalendarYear',
        },
        {
          name: '$200 Uber Annual Credit',
          type: 'StatementCredit',
          stickerValue: 20000, // $200
          resetCadence: 'CalendarYear',
        },
        {
          name: '$209 CLEAR Annual Credit',
          type: 'StatementCredit',
          stickerValue: 20900, // $209
          resetCadence: 'CalendarYear',
        },
        {
          name: 'Centurion Lounge Access',
          type: 'TravelPerk',
          stickerValue: 50000, // Unlimited access
          resetCadence: 'CalendarYear',
        },
        {
          name: 'Complimentary Airport Meet & Greet',
          type: 'TravelPerk',
          stickerValue: 5000, // Per trip
          resetCadence: 'TripBased',
        },
        {
          name: 'Global Entry or TSA PreCheck',
          type: 'StatementCredit',
          stickerValue: 10500, // $105
          resetCadence: 'FirstYear',
        },
        {
          name: 'Fine Hotels & Resorts Partner Program',
          type: 'TravelPerk',
          stickerValue: 20000, // Upgrades, late checkout
          resetCadence: 'CalendarYear',
        },
      ],
      signupBonus: '175,000 Membership Rewards points (~$2,625 value)',
      loyaltyProgram: 'American Express Membership Rewards',
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
          stickerValue: 0, // Incorporated into earn rates
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
          stickerValue: 12000, // $120
          resetCadence: 'CalendarYear',
        },
        {
          name: '$100 Annual Uber Credit',
          type: 'StatementCredit',
          stickerValue: 10000, // $100 (NEW for 2026)
          resetCadence: 'CalendarYear',
        },
        {
          name: 'Purchase Protection',
          type: 'Protection',
          stickerValue: 0, // 120 days
          resetCadence: 'None',
        },
      ],
      signupBonus: '75,000 Membership Rewards points (~$1,125 value)',
      loyaltyProgram: 'American Express Membership Rewards',
    },

    // ========================================================================
    // CAPITAL ONE VENTURE SERIES
    // ========================================================================

    {
      issuer: 'Capital One',
      cardName: 'Capital One Venture X',
      defaultAnnualFee: 39500, // $395
      cardImageUrl:
        'https://www.capitalone.com/credit-cards/venture-x/img/og-image-default.jpg',
      benefits: [
        {
          name: '$300 Annual Travel Credit',
          type: 'StatementCredit',
          stickerValue: 30000, // $300
          resetCadence: 'CalendarYear',
        },
        {
          name: 'Priority Pass Select Lounge Access',
          type: 'TravelPerk',
          stickerValue: 20000, // Unlimited access
          resetCadence: 'CalendarYear',
        },
        {
          name: 'Trip Cancellation Insurance',
          type: 'Insurance',
          stickerValue: 10000, // ~$100
          resetCadence: 'TripBased',
        },
        {
          name: 'Trip Delay Reimbursement',
          type: 'Insurance',
          stickerValue: 50000, // $500 coverage
          resetCadence: 'TripBased',
        },
        {
          name: 'Baggage Delay Insurance',
          type: 'Insurance',
          stickerValue: 25000, // $250 coverage
          resetCadence: 'TripBased',
        },
      ],
      signupBonus: '100,000 miles (~$1,000 value)',
      loyaltyProgram: 'Capital One Venture',
    },

    {
      issuer: 'Capital One',
      cardName: 'Capital One Venture',
      defaultAnnualFee: 9500, // $95
      cardImageUrl:
        'https://www.capitalone.com/credit-cards/venture/img/og-image-default.jpg',
      benefits: [
        {
          name: '2x Miles on All Purchases',
          type: 'Rewards',
          stickerValue: 0,
          resetCadence: 'None',
        },
        {
          name: 'Trip Cancellation Insurance',
          type: 'Insurance',
          stickerValue: 10000, // ~$100
          resetCadence: 'TripBased',
        },
        {
          name: 'Trip Delay Reimbursement',
          type: 'Insurance',
          stickerValue: 30000, // $300 coverage
          resetCadence: 'TripBased',
        },
        {
          name: 'Purchase Protection',
          type: 'Protection',
          stickerValue: 0,
          resetCadence: 'None',
        },
      ],
      signupBonus: '100,000 miles (~$1,000 value)',
      loyaltyProgram: 'Capital One Venture',
    },

    // ========================================================================
    // CHASE FREEDOM SERIES (No Annual Fee)
    // ========================================================================

    {
      issuer: 'Chase',
      cardName: 'Chase Freedom Flex',
      defaultAnnualFee: 0, // No annual fee
      cardImageUrl:
        'https://creditcards.chaseonline.com/images/cardart/freedom_flex_card_art.png',
      benefits: [
        {
          name: '5% Cash Back on Rotating Categories',
          type: 'CashBack',
          stickerValue: 0,
          resetCadence: 'Quarterly',
        },
        {
          name: '1.5% Cash Back on All Other Purchases',
          type: 'CashBack',
          stickerValue: 0,
          resetCadence: 'None',
        },
        {
          name: 'Purchase Protection',
          type: 'Protection',
          stickerValue: 0,
          resetCadence: 'None',
        },
      ],
      signupBonus: '$200 cash rewards',
      loyaltyProgram: 'Chase Ultimate Rewards',
    },

    {
      issuer: 'Chase',
      cardName: 'Chase Freedom Unlimited',
      defaultAnnualFee: 0, // No annual fee
      cardImageUrl:
        'https://creditcards.chaseonline.com/images/cardart/freedom_unlimited_card_art.png',
      benefits: [
        {
          name: '3% Cash Back on Dining, Groceries (first 12 months), Gas',
          type: 'CashBack',
          stickerValue: 0,
          resetCadence: 'CardmemberYear',
        },
        {
          name: '1.5% Cash Back on All Other Purchases',
          type: 'CashBack',
          stickerValue: 0,
          resetCadence: 'None',
        },
        {
          name: 'Purchase Protection',
          type: 'Protection',
          stickerValue: 0,
          resetCadence: 'None',
        },
      ],
      signupBonus: '$200 cash rewards',
      loyaltyProgram: 'Chase Ultimate Rewards',
    },

    // ========================================================================
    // US BANK ALTITUDE SERIES
    // ========================================================================

    {
      issuer: 'US Bank',
      cardName: 'US Bank Altitude Reserve Visa Infinite',
      defaultAnnualFee: 40000, // $400
      cardImageUrl:
        'https://www.usbank.com/credit-cards/altitude-reserve-visa-infinite-card.html',
      benefits: [
        {
          name: '$325 Annual Travel Credit',
          type: 'StatementCredit',
          stickerValue: 32500, // $325
          resetCadence: 'CalendarYear',
        },
        {
          name: '$100 Annual Dining Credit',
          type: 'StatementCredit',
          stickerValue: 10000, // $100
          resetCadence: 'CalendarYear',
        },
        {
          name: 'Priority Pass Select Lounge Access',
          type: 'TravelPerk',
          stickerValue: 20000, // Unlimited
          resetCadence: 'CalendarYear',
        },
        {
          name: 'Trip Cancellation Insurance',
          type: 'Insurance',
          stickerValue: 10000, // ~$100
          resetCadence: 'TripBased',
        },
        {
          name: 'Baggage Delay Insurance',
          type: 'Insurance',
          stickerValue: 25000, // $250 coverage
          resetCadence: 'TripBased',
        },
      ],
      signupBonus: '100,000 points (~$1,500 value)',
      loyaltyProgram: 'US Bank Rewards',
    },

    {
      issuer: 'US Bank',
      cardName: 'US Bank Altitude Go Visa Signature',
      defaultAnnualFee: 0, // No annual fee
      cardImageUrl:
        'https://www.usbank.com/credit-cards/altitude-go-visa-signature-card.html',
      benefits: [
        {
          name: '4x Points on Dining & Entertainment',
          type: 'Rewards',
          stickerValue: 0,
          resetCadence: 'None',
        },
        {
          name: '2x Points on Travel & Gas',
          type: 'Rewards',
          stickerValue: 0,
          resetCadence: 'None',
        },
        {
          name: 'Extended Purchase Protection',
          type: 'Protection',
          stickerValue: 0,
          resetCadence: 'None',
        },
      ],
      signupBonus: '20,000 bonus points (~$200 value)',
      loyaltyProgram: 'US Bank Rewards',
    },

    // ========================================================================
    // AIRLINE CARDS
    // ========================================================================

    {
      issuer: 'Chase',
      cardName: 'Chase Southwest Rapid Rewards Premier',
      defaultAnnualFee: 6900, // $69
      cardImageUrl:
        'https://creditcards.chaseonline.com/images/cardart/southwest_rapid_rewards_premier.png',
      benefits: [
        {
          name: '3x Points on Southwest Flights & Purchases',
          type: 'Rewards',
          stickerValue: 0,
          resetCadence: 'None',
        },
        {
          name: 'Companion Pass (with signup bonus)',
          type: 'TravelPerk',
          stickerValue: 200000, // One free companion ticket
          resetCadence: 'Signup',
        },
        {
          name: 'Anniversary Bonus Points',
          type: 'Rewards',
          stickerValue: 6000, // 6,000 points annually
          resetCadence: 'CardmemberYear',
        },
        {
          name: 'Trip Cancellation Insurance',
          type: 'Insurance',
          stickerValue: 10000, // ~$100
          resetCadence: 'TripBased',
        },
      ],
      signupBonus: '75,000 bonus points + $75 statement credit (~$825 value)',
      loyaltyProgram: 'Southwest Rapid Rewards',
    },

    {
      issuer: 'Chase',
      cardName: 'United Airlines Explorer Card',
      defaultAnnualFee: 9500, // $95
      cardImageUrl:
        'https://creditcards.chaseonline.com/images/cardart/united_explorer_card.png',
      benefits: [
        {
          name: '2x Miles on United Travel & Dining',
          type: 'Rewards',
          stickerValue: 0,
          resetCadence: 'None',
        },
        {
          name: 'Free Checked Bag',
          type: 'TravelPerk',
          stickerValue: 30000, // ~$300 annual value
          resetCadence: 'CalendarYear',
        },
        {
          name: '1 United Club Pass',
          type: 'TravelPerk',
          stickerValue: 20000, // Lounge access
          resetCadence: 'CardmemberYear',
        },
        {
          name: 'Trip Cancellation Insurance',
          type: 'Insurance',
          stickerValue: 10000, // ~$100
          resetCadence: 'TripBased',
        },
      ],
      signupBonus: '100,000 bonus miles (~$1,000 value)',
      loyaltyProgram: 'United Airlines MileagePlus',
    },

    // ========================================================================
    // HOTEL CARDS
    // ========================================================================

    {
      issuer: 'Chase',
      cardName: 'Chase Hyatt Credit Card',
      defaultAnnualFee: 95000, // $95
      cardImageUrl: 'https://creditcards.chaseonline.com/images/cardart/hyatt_card.png',
      benefits: [
        {
          name: '4x Points on Hyatt Hotels',
          type: 'Rewards',
          stickerValue: 0,
          resetCadence: 'None',
        },
        {
          name: 'Free Night Award Certificate',
          type: 'TravelPerk',
          stickerValue: 100000, // Up to $200 nightly value
          resetCadence: 'CardmemberYear',
        },
        {
          name: 'Complimentary Room Upgrade',
          type: 'TravelPerk',
          stickerValue: 10000,
          resetCadence: 'TripBased',
        },
        {
          name: 'Late Checkout',
          type: 'TravelPerk',
          stickerValue: 5000,
          resetCadence: 'TripBased',
        },
      ],
      signupBonus: '80,000 bonus points + free night award (~$1,300 value)',
      loyaltyProgram: 'World of Hyatt',
    },

    {
      issuer: 'American Express',
      cardName: 'American Express Marriott Bonvoy Brilliant Credit Card',
      defaultAnnualFee: 49500, // $495
      cardImageUrl:
        'https://www.americanexpress.com/content/dam/amex/us/credit-cards/travel/images/learn/marriott-bonvoy-brilliant.jpg',
      benefits: [
        {
          name: '6x Points on Marriott Purchases',
          type: 'Rewards',
          stickerValue: 0,
          resetCadence: 'None',
        },
        {
          name: 'Free Night Award Certificate',
          type: 'TravelPerk',
          stickerValue: 200000, // Up to $400 nightly value
          resetCadence: 'CardmemberYear',
        },
        {
          name: 'Complimentary Room Upgrade',
          type: 'TravelPerk',
          stickerValue: 10000,
          resetCadence: 'TripBased',
        },
        {
          name: '$300 Annual Airline Fee Credit',
          type: 'StatementCredit',
          stickerValue: 30000, // $300
          resetCadence: 'CalendarYear',
        },
      ],
      signupBonus: '150,000 Marriott Bonvoy points (~$1,875 value)',
      loyaltyProgram: 'Marriott Bonvoy',
    },

    {
      issuer: 'American Express',
      cardName: 'American Express Hilton Honors Surpass Card',
      defaultAnnualFee: 15000, // $150
      cardImageUrl:
        'https://www.americanexpress.com/content/dam/amex/us/credit-cards/travel/images/learn/hilton-honors-surpass.jpg',
      benefits: [
        {
          name: '6x Points on Hilton Purchases',
          type: 'Rewards',
          stickerValue: 0,
          resetCadence: 'None',
        },
        {
          name: 'Free Night Certificate',
          type: 'TravelPerk',
          stickerValue: 150000, // Up to $300 nightly value
          resetCadence: 'CardmemberYear',
        },
        {
          name: 'Hilton Lounge Access',
          type: 'TravelPerk',
          stickerValue: 15000,
          resetCadence: 'CalendarYear',
        },
        {
          name: '$200 Airline Incidental Fee Credit',
          type: 'StatementCredit',
          stickerValue: 20000, // $200
          resetCadence: 'CalendarYear',
        },
      ],
      signupBonus: '150,000 Hilton Honors points (~$1,500 value)',
      loyaltyProgram: 'Hilton Honors',
    },

    // ========================================================================
    // BUSINESS CARDS
    // ========================================================================

    {
      issuer: 'Chase',
      cardName: 'Chase Ink Preferred Business',
      defaultAnnualFee: 9500, // $95
      cardImageUrl:
        'https://creditcards.chaseonline.com/images/cardart/business_preferred_card_art.png',
      benefits: [
        {
          name: '3x Points on Shipping, Internet & Cable, Travel',
          type: 'Rewards',
          stickerValue: 0,
          resetCadence: 'None',
        },
        {
          name: '1x Points on All Other Purchases',
          type: 'Rewards',
          stickerValue: 0,
          resetCadence: 'None',
        },
        {
          name: 'Purchase Protection',
          type: 'Protection',
          stickerValue: 0,
          resetCadence: 'None',
        },
      ],
      signupBonus: '100,000 bonus points (~$1,000 value)',
      loyaltyProgram: 'Chase Ultimate Rewards',
    },

    {
      issuer: 'Chase',
      cardName: 'Chase Ink Business Premier',
      defaultAnnualFee: 19500, // $195
      cardImageUrl:
        'https://creditcards.chaseonline.com/images/cardart/ink_premier_card_art.png',
      benefits: [
        {
          name: '3x Points on Shipping, Internet & Cable, Travel',
          type: 'Rewards',
          stickerValue: 0,
          resetCadence: 'None',
        },
        {
          name: '2x Points on Gas & Dining',
          type: 'Rewards',
          stickerValue: 0,
          resetCadence: 'None',
        },
        {
          name: 'Concierge Service',
          type: 'Service',
          stickerValue: 5000,
          resetCadence: 'CalendarYear',
        },
        {
          name: 'Trip Cancellation Insurance',
          type: 'Insurance',
          stickerValue: 10000, // ~$100
          resetCadence: 'TripBased',
        },
      ],
      signupBonus: '150,000 bonus points (~$1,500 value)',
      loyaltyProgram: 'Chase Ultimate Rewards',
    },

    {
      issuer: 'American Express',
      cardName: 'American Express Business Gold Card',
      defaultAnnualFee: 29500, // $295
      cardImageUrl:
        'https://www.americanexpress.com/content/dam/amex/us/credit-cards/business/images/learn/biz_gold_card_art_375x237.jpg',
      benefits: [
        {
          name: '4x Points on Flights, Gas, Groceries',
          type: 'Rewards',
          stickerValue: 0,
          resetCadence: 'None',
        },
        {
          name: '1x Points on All Other Purchases',
          type: 'Rewards',
          stickerValue: 0,
          resetCadence: 'None',
        },
        {
          name: 'Statement Credits',
          type: 'StatementCredit',
          stickerValue: 15000, // Various credits
          resetCadence: 'CalendarYear',
        },
      ],
      signupBonus: '100,000 Membership Rewards points (~$1,000 value)',
      loyaltyProgram: 'American Express Membership Rewards',
    },

    {
      issuer: 'Chase',
      cardName: 'Chase Ink Unlimited Business',
      defaultAnnualFee: 0, // No annual fee
      cardImageUrl:
        'https://creditcards.chaseonline.com/images/cardart/ink_unlimited_card.png',
      benefits: [
        {
          name: '1.5x Points on All Purchases',
          type: 'Rewards',
          stickerValue: 0,
          resetCadence: 'None',
        },
        {
          name: 'Purchase Protection',
          type: 'Protection',
          stickerValue: 0,
          resetCadence: 'None',
        },
      ],
      signupBonus: '100,000 bonus points (~$1,000 value)',
      loyaltyProgram: 'Chase Ultimate Rewards',
    },

    // ========================================================================
    // CASH BACK & OTHER PREMIUM CARDS
    // ========================================================================

    {
      issuer: 'Wells Fargo',
      cardName: 'Wells Fargo Propel American Express',
      defaultAnnualFee: 0, // No annual fee
      cardImageUrl: 'https://www.wellsfargo.com/credit-cards/propel-american-express/',
      benefits: [
        {
          name: '3x Points on Flights, Hotels, Rental Cars, Gas & Dining',
          type: 'Rewards',
          stickerValue: 0,
          resetCadence: 'None',
        },
        {
          name: '1x Points on All Other Purchases',
          type: 'Rewards',
          stickerValue: 0,
          resetCadence: 'None',
        },
        {
          name: 'Purchase Protection',
          type: 'Protection',
          stickerValue: 0,
          resetCadence: 'None',
        },
      ],
      signupBonus: '20,000 bonus points (~$200 value)',
      loyaltyProgram: 'Wells Fargo Rewards',
    },

    {
      issuer: 'Wells Fargo',
      cardName: 'Wells Fargo Active Cash',
      defaultAnnualFee: 0, // No annual fee
      cardImageUrl: 'https://www.wellsfargo.com/credit-cards/wells-fargo-active-cash/',
      benefits: [
        {
          name: '2% Cash Back on All Purchases',
          type: 'CashBack',
          stickerValue: 0,
          resetCadence: 'None',
        },
        {
          name: 'Purchase Protection',
          type: 'Protection',
          stickerValue: 0,
          resetCadence: 'None',
        },
      ],
      signupBonus: '$200 cash rewards',
      loyaltyProgram: 'Wells Fargo Rewards',
    },

    {
      issuer: 'Discover',
      cardName: 'Discover it Card',
      defaultAnnualFee: 0, // No annual fee
      cardImageUrl:
        'https://www.discover.com/credit-cards/discover-it/images/og-discover-it-card.jpg',
      benefits: [
        {
          name: '5% Cash Back on Rotating Categories',
          type: 'CashBack',
          stickerValue: 0,
          resetCadence: 'Quarterly',
        },
        {
          name: '1% Cash Back on All Other Purchases',
          type: 'CashBack',
          stickerValue: 0,
          resetCadence: 'None',
        },
        {
          name: 'Cashback Match (First Year)',
          type: 'CashBack',
          stickerValue: 0, // Discover matches cashback earned
          resetCadence: 'FirstYear',
        },
      ],
      signupBonus: 'Cashback offer varies (~$100-200 value)',
      loyaltyProgram: 'Discover Cashback',
    },

    {
      issuer: 'Citi',
      cardName: 'Citi Custom Cash Card',
      defaultAnnualFee: 0, // No annual fee
      cardImageUrl: 'https://www.citi.com/credit-cards/custom-cash-card/',
      benefits: [
        {
          name: '5% Cash Back on Your Top Spending Category',
          type: 'CashBack',
          stickerValue: 0,
          resetCadence: 'Monthly',
        },
        {
          name: '1% Cash Back on All Other Purchases',
          type: 'CashBack',
          stickerValue: 0,
          resetCadence: 'None',
        },
      ],
      signupBonus: '$200 cash bonus',
      loyaltyProgram: 'Citi Rewards',
    },

    // ========================================================================
    // PREMIUM TRAVEL CARDS (Additional)
    // ========================================================================

    {
      issuer: 'Citi',
      cardName: 'Citi Prestige Card',
      defaultAnnualFee: 49500, // $495
      cardImageUrl: 'https://www.citi.com/credit-cards/prestige-card/',
      benefits: [
        {
          name: '$250 Annual Travel Credit',
          type: 'StatementCredit',
          stickerValue: 25000, // $250
          resetCadence: 'CalendarYear',
        },
        {
          name: '3x Prestige Points on Airfare, Hotels, Car Rentals',
          type: 'Rewards',
          stickerValue: 0,
          resetCadence: 'None',
        },
        {
          name: 'Fourth Night Free at Hotels',
          type: 'TravelPerk',
          stickerValue: 50000, // Travel booking perk
          resetCadence: 'CalendarYear',
        },
        {
          name: 'Concierge Services',
          type: 'Service',
          stickerValue: 5000,
          resetCadence: 'CalendarYear',
        },
      ],
      signupBonus: '100,000 Prestige Points (~$1,000 value)',
      loyaltyProgram: 'Citi Prestige Points',
    },

    {
      issuer: 'American Express',
      cardName: 'American Express Green Card',
      defaultAnnualFee: 15000, // $150
      cardImageUrl:
        'https://www.americanexpress.com/content/dam/amex/us/credit-cards/images/learn/green_cardart_375x237.jpg',
      benefits: [
        {
          name: '3x Membership Rewards on Flights, Trains, Hotels',
          type: 'Rewards',
          stickerValue: 0,
          resetCadence: 'None',
        },
        {
          name: '1x Membership Rewards on All Other Purchases',
          type: 'Rewards',
          stickerValue: 0,
          resetCadence: 'None',
        },
        {
          name: 'Statement Credits for Travel',
          type: 'StatementCredit',
          stickerValue: 10000, // Various credits
          resetCadence: 'CalendarYear',
        },
      ],
      signupBonus: '60,000 Membership Rewards points (~$900 value)',
      loyaltyProgram: 'American Express Membership Rewards',
    },

    {
      issuer: 'Barclays',
      cardName: 'Barclays JetBlue Plus Card',
      defaultAnnualFee: 9500, // $95
      cardImageUrl: 'https://www.barclaycardus.com/cards/jetblue.html',
      benefits: [
        {
          name: '3x Points on JetBlue Flights',
          type: 'Rewards',
          stickerValue: 0,
          resetCadence: 'None',
        },
        {
          name: 'Free Checked Bags',
          type: 'TravelPerk',
          stickerValue: 30000, // Two free bags
          resetCadence: 'CalendarYear',
        },
        {
          name: 'Inflight Free Drinks & Snacks',
          type: 'TravelPerk',
          stickerValue: 5000,
          resetCadence: 'CalendarYear',
        },
      ],
      signupBonus: '60,000 bonus miles (~$600 value)',
      loyaltyProgram: 'JetBlue TrueBlue',
    },
  ];

  console.log(`\n🚀 Starting seed of ${cardsData.length} April 2026 credit cards...\n`);
  console.log('💾 Seeding database with DOLLAR values (stored as cents)...\n');

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  // Create all cards with benefits
  for (const cardData of cardsData) {
    try {
      const masterCard = await prisma.masterCard.create({
        data: {
          issuer: cardData.issuer,
          cardName: cardData.cardName,
          defaultAnnualFee: cardData.defaultAnnualFee, // Stored in cents
          cardImageUrl: cardData.cardImageUrl,
        },
      });

      // Create benefits for this card
      if (cardData.benefits && cardData.benefits.length > 0) {
        await prisma.masterBenefit.createMany({
          data: cardData.benefits.map((benefit) => ({
            masterCardId: masterCard.id,
            ...benefit,
          })),
        });
      }

      console.log(
        `✅ ${cardData.cardName} (${cardData.benefits?.length || 0} benefits)`
      );
      successCount++;
    } catch (error) {
      // Handle duplicate card error gracefully
      if (error.code === 'P2002') {
        console.log(`⚠️  ${cardData.cardName} already exists, skipping...`);
        skipCount++;
      } else {
        console.error(
          `❌ Error creating ${cardData.cardName}:`,
          error.message
        );
        errorCount++;
      }
    }
  }

  console.log(`\n✨ Seed complete!`);
  console.log(`   Created: ${successCount} cards`);
  console.log(`   Skipped: ${skipCount} cards (already exist)`);
  if (errorCount > 0) console.log(`   Errors: ${errorCount} cards`);

  const totalBenefits = cardsData.reduce(
    (acc, card) => acc + (card.benefits?.length || 0),
    0
  );
  console.log(`   Total benefits: ${totalBenefits}\n`);

  console.log('📊 Key April 2026 Updates:');
  console.log('   • Chase Sapphire Reserve: $795 annual fee (was $550)');
  console.log('   • Amex Platinum: $895 annual fee (was $695)');
  console.log('   • Amex Gold: $325 annual fee (was $250)');
  console.log('   • All values in DOLLARS for clarity\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
